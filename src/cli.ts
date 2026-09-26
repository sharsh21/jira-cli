#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command, InvalidArgumentError } from "commander";
import { textToAdf } from "./adf.js";
import { configPath, loadConfig, saveConfig, JiraConfig } from "./config.js";
import { CliError, formatError } from "./errors.js";
import {
  normalizeBaseUrl,
  parseDate,
  parseDuration,
  parseIssueKey,
  toJiraDateTime,
} from "./format.js";
import { JiraClient } from "./jiraClient.js";
import { Prompter } from "./prompt.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wraps a command action so every failure prints one clean line and exits non-zero. */
function run<Args extends unknown[]>(action: (...args: Args) => Promise<void>) {
  return async (...args: Args): Promise<void> => {
    try {
      await action(...args);
    } catch (err) {
      console.error(`Error: ${formatError(err)}`);
      if (process.env.JIRA_CLI_DEBUG && err instanceof Error && !(err instanceof CliError)) {
        console.error(err.stack);
      }
      process.exitCode = 1;
    }
  };
}

/** Adapts a validator so commander reports its failures as normal usage errors. */
function validated<T>(parse: (value: string) => T) {
  return (value: string): T => {
    try {
      return parse(value);
    } catch (err) {
      throw new InvalidArgumentError(formatError(err));
    }
  };
}

async function connect(): Promise<{ config: JiraConfig; client: JiraClient }> {
  const config = await loadConfig();
  return { config, client: new JiraClient(config) };
}

function issueUrl(config: JiraConfig, issueKey: string): string {
  return `${config.baseUrl.replace(/\/+$/, "")}/browse/${issueKey}`;
}

async function resolveAssignee(
  client: JiraClient,
  config: JiraConfig,
  value: string,
): Promise<string> {
  if (value.toLowerCase() === "me") return config.myAccountId;

  const users = (await client.searchUsers(value)).filter((user) => user.active !== false);
  const exact = users.filter((user) => user.emailAddress?.toLowerCase() === value.toLowerCase());

  if (exact.length === 1) return exact[0].accountId;
  if (users.length === 1) return users[0].accountId;
  if (users.length === 0) throw new CliError(`No active Jira user matches "${value}".`);

  const names = users
    .slice(0, 5)
    .map((user) => user.displayName)
    .join(", ");
  throw new CliError(`"${value}" matches several users (${names}). Use their full email address.`);
}

async function resolveIssueTypeId(
  client: JiraClient,
  projectKey: string,
  typeName: string | undefined,
  subtask: boolean,
): Promise<string> {
  const types = await client.getProjectIssueTypes(projectKey);

  if (subtask) {
    const subtaskType = types.find((type) => type.subtask);
    if (!subtaskType) throw new CliError(`Project ${projectKey} does not have subtasks enabled.`);
    return subtaskType.id;
  }

  const wanted = (typeName ?? "Task").toLowerCase();
  const match = types.find((type) => !type.subtask && type.name.toLowerCase() === wanted);
  if (!match) {
    const available = types.filter((type) => !type.subtask).map((type) => type.name);
    throw new CliError(
      `Project ${projectKey} has no issue type "${typeName}". Available: ${available.join(", ")}.`,
    );
  }
  return match.id;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const program = new Command()
  .name("jira-cli")
  .description("Create and update Jira Cloud issues and log work from the terminal.")
  .version(version)
  .showHelpAfterError("(add --help for usage)");

const configCommand = program.command("config").description("Manage your Jira connection settings");

configCommand
  .command("init")
  .description("Set up or update your Jira site, email, and API token")
  .action(
    run(async () => {
      const existing = await loadConfig().catch(() => undefined);
      const prompter = new Prompter();

      let draft: JiraConfig;
      try {
        const baseUrl = normalizeBaseUrl(
          await prompter.ask(
            "Jira site URL (e.g. https://yoursite.atlassian.net)",
            existing?.baseUrl,
          ),
        );
        const email = await prompter.ask("Jira account email", existing?.email);
        const apiToken =
          (await prompter.askSecret(
            existing
              ? "API token (leave blank to keep the current one)"
              : "API token (create one at https://id.atlassian.com/manage-profile/security/api-tokens)",
          )) ||
          existing?.apiToken ||
          "";
        const defaultProjectKey = await prompter.ask(
          "Default project key (optional)",
          existing?.defaultProjectKey,
        );

        if (!email || !apiToken) throw new CliError("Email and API token are required.");

        draft = {
          baseUrl,
          email,
          apiToken,
          myAccountId: "",
          defaultProjectKey: defaultProjectKey ? defaultProjectKey.toUpperCase() : undefined,
        };
      } finally {
        prompter.close();
      }

      const me = await new JiraClient(draft).myself();
      draft.myAccountId = me.accountId;
      await saveConfig(draft);
      console.log(`Signed in as ${me.displayName}. Settings saved to ${configPath()}.`);
    }),
  );

configCommand
  .command("path")
  .description("Print the location of the config file")
  .action(() => console.log(configPath()));

program
  .command("whoami")
  .description("Check your credentials and show the signed-in Jira user")
  .action(
    run(async () => {
      const { client } = await connect();
      const me = await client.myself();
      const email = me.emailAddress ? ` <${me.emailAddress}>` : "";
      console.log(`${me.displayName}${email} (${me.accountId})`);
    }),
  );

program
  .command("create")
  .description("Create an issue, or a subtask with --parent")
  .requiredOption("--summary <text>", "issue title")
  .option("--type <name>", "issue type, e.g. Task, Story, Bug (default: Task)")
  .option("--project <key>", "project key (default: from config)")
  .option("--description <text>", "plain-text description")
  .option("--parent <key>", "create a subtask under this issue", validated(parseIssueKey))
  .option("--assignee <email|me>", "assignee's email address, or 'me'")
  .option("--time <estimate>", "original estimate, e.g. 2h, 1d", validated(parseDuration))
  .action(
    run(
      async (opts: {
        summary: string;
        type?: string;
        project?: string;
        description?: string;
        parent?: string;
        assignee?: string;
        time?: string;
      }) => {
        if (opts.parent && opts.type) {
          throw new CliError(
            "--type can't be combined with --parent. Subtasks use the project's subtask type.",
          );
        }

        const { config, client } = await connect();

        let projectKey = opts.project?.toUpperCase() ?? config.defaultProjectKey;
        if (opts.parent) {
          const parentProject = await client.getIssueProjectKey(opts.parent);
          if (opts.project && projectKey !== parentProject) {
            throw new CliError(`Subtasks must be in the parent's project (${parentProject}).`);
          }
          projectKey = parentProject;
        }
        if (!projectKey) {
          throw new CliError(
            "No project given. Pass --project or set a default with 'jira-cli config init'.",
          );
        }

        const fields: Record<string, unknown> = {
          project: { key: projectKey },
          summary: opts.summary,
          issuetype: {
            id: await resolveIssueTypeId(client, projectKey, opts.type, Boolean(opts.parent)),
          },
        };
        if (opts.description) fields.description = textToAdf(opts.description);
        if (opts.parent) fields.parent = { key: opts.parent };
        if (opts.time) fields.timetracking = { originalEstimate: opts.time };
        if (opts.assignee)
          fields.assignee = { id: await resolveAssignee(client, config, opts.assignee) };

        const issue = await client.createIssue(fields);
        console.log(`Created ${issue.key}: ${issueUrl(config, issue.key)}`);
      },
    ),
  );

program
  .command("log-work")
  .description("Log time spent on an issue")
  .argument("<issueKey>", "issue to log work on, e.g. ENG-123", validated(parseIssueKey))
  .requiredOption("--time <duration>", "time spent, e.g. 1h30m, 45m", validated(parseDuration))
  .option("--comment <text>", "what you worked on")
  .option(
    "--started <date>",
    "when the work started, ISO 8601 (default: now)",
    validated(parseDate),
  )
  .action(
    run(async (issueKey: string, opts: { time: string; comment?: string; started?: Date }) => {
      const { client } = await connect();
      await client.addWorklog(issueKey, {
        timeSpent: opts.time,
        started: toJiraDateTime(opts.started ?? new Date()),
        ...(opts.comment ? { comment: textToAdf(opts.comment) } : {}),
      });
      console.log(`Logged ${opts.time} on ${issueKey}.`);
    }),
  );

program
  .command("update")
  .description("Edit an issue or move it to a new status")
  .argument("<issueKey>", "issue to update, e.g. ENG-123", validated(parseIssueKey))
  .option("--summary <text>", "new title")
  .option("--description <text>", "new plain-text description")
  .option("--assignee <email|me>", "new assignee's email address, or 'me'")
  .option("--status <name>", "move to this status, e.g. 'In Progress', 'Done'")
  .action(
    run(
      async (
        issueKey: string,
        opts: { summary?: string; description?: string; assignee?: string; status?: string },
      ) => {
        if (!opts.summary && !opts.description && !opts.assignee && !opts.status) {
          throw new CliError(
            "Nothing to update. Pass --summary, --description, --assignee, or --status.",
          );
        }

        const { config, client } = await connect();

        // Find the transition first so a bad status name fails before anything changes.
        let transitionId: string | undefined;
        if (opts.status) {
          const wanted = opts.status.toLowerCase();
          const transitions = await client.getTransitions(issueKey);
          transitionId = transitions.find((t) => t.name.toLowerCase() === wanted)?.id;
          if (!transitionId) {
            const available = transitions.map((t) => t.name).join(", ") || "none";
            throw new CliError(
              `Can't move ${issueKey} to "${opts.status}". Available: ${available}.`,
            );
          }
        }

        const fields: Record<string, unknown> = {};
        if (opts.summary) fields.summary = opts.summary;
        if (opts.description) fields.description = textToAdf(opts.description);
        if (opts.assignee)
          fields.assignee = { id: await resolveAssignee(client, config, opts.assignee) };

        if (Object.keys(fields).length > 0) await client.updateIssue(issueKey, fields);
        if (transitionId) await client.transitionIssue(issueKey, transitionId);

        console.log(`Updated ${issueKey}: ${issueUrl(config, issueKey)}`);
      },
    ),
  );

await program.parseAsync(process.argv);
