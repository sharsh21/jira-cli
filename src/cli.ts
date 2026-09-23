#!/usr/bin/env node
import { Command } from "commander";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadConfig, saveConfig, configPath, JiraConfig } from "./config.js";
import { JiraClient, extractErrorMessage } from "./jiraClient.js";
import { textToADF } from "./adf.js";

const program = new Command();
program.name("jira-cli").description("Create/update Jira issues and log work from the terminal");

async function prompt(rl: readline.Interface, question: string, def?: string) {
  const suffix = def ? ` (${def})` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || def || "";
}

async function resolveAssignee(
  client: JiraClient,
  assignee: string | undefined,
  config: JiraConfig
): Promise<string | undefined> {
  if (!assignee || assignee === "me") return config.myAccountId;
  const users = await client.searchUser(assignee);
  if (users.length === 0) {
    throw new Error(`No Jira user found matching "${assignee}"`);
  }
  return users[0].accountId;
}

const configCmd = program.command("config").description("Manage jira-cli configuration");

configCmd
  .command("init")
  .description("Interactively set up Jira Cloud credentials")
  .action(async () => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      const baseUrl = await prompt(rl, "Jira base URL (e.g. https://yoursite.atlassian.net)");
      const email = await prompt(rl, "Your Jira account email");
      const apiToken = await prompt(rl, "API token (create at id.atlassian.com/manage-profile/security/api-tokens)");
      const defaultProjectKey = await prompt(rl, "Default project key (optional)");
      rl.close();

      const draft: JiraConfig = {
        baseUrl,
        email,
        apiToken,
        myAccountId: "",
        defaultProjectKey: defaultProjectKey || undefined,
      };

      const client = new JiraClient(draft);
      const me = await client.myself();
      draft.myAccountId = me.accountId;

      await saveConfig(draft);
      console.log(`Saved config to ${configPath()} (verified as ${me.displayName}).`);
    } catch (err) {
      rl.close();
      console.error(`Config setup failed: ${extractErrorMessage(err)}`);
      process.exitCode = 1;
    }
  });

configCmd
  .command("path")
  .description("Print the config file location")
  .action(() => {
    console.log(configPath());
  });

program
  .command("whoami")
  .description("Verify credentials and show the authenticated Jira user")
  .action(async () => {
    try {
      const config = await loadConfig();
      const client = new JiraClient(config);
      const me = await client.myself();
      console.log(`${me.displayName} <${me.emailAddress}> (${me.accountId})`);
    } catch (err) {
      console.error(extractErrorMessage(err));
      process.exitCode = 1;
    }
  });

program
  .command("create")
  .description("Create a Jira issue (task/story/bug), optionally as a subtask of a parent")
  .requiredOption("--summary <text>", "Issue summary")
  .option("--type <type>", "Issue type: Task, Story, Bug, Sub-task", "Task")
  .option("--project <key>", "Project key (defaults to config default)")
  .option("--description <text>", "Issue description")
  .option("--parent <key>", "Parent issue key (implies a subtask)")
  .option("--assignee <emailOrMe>", "Assignee email, or 'me'")
  .option("--time <estimate>", "Original time estimate, e.g. 2h, 1d")
  .action(async (opts) => {
    try {
      const config = await loadConfig();
      const client = new JiraClient(config);

      const projectKey = opts.project || config.defaultProjectKey;
      if (!projectKey) {
        throw new Error("No --project given and no defaultProjectKey configured.");
      }

      const issueType = opts.parent ? "Sub-task" : opts.type;

      const fields: Record<string, unknown> = {
        project: { key: projectKey },
        summary: opts.summary,
        issuetype: { name: issueType },
      };

      if (opts.description) fields.description = textToADF(opts.description);
      if (opts.parent) fields.parent = { key: opts.parent };
      if (opts.time) fields.timetracking = { originalEstimate: opts.time };

      const accountId = await resolveAssignee(client, opts.assignee, config);
      if (accountId) fields.assignee = { id: accountId };

      const issue = await client.createIssue(fields);
      console.log(`Created ${issue.key}: ${config.baseUrl.replace(/\/$/, "")}/browse/${issue.key}`);
    } catch (err) {
      console.error(extractErrorMessage(err));
      process.exitCode = 1;
    }
  });

program
  .command("log-work <issueKey>")
  .description("Add a worklog entry to an existing issue")
  .requiredOption("--time <duration>", "Time spent, e.g. 2h, 30m, 1d")
  .option("--comment <text>", "Worklog comment")
  .option("--started <isoDate>", "When the work started (ISO 8601); defaults to now")
  .action(async (issueKey, opts) => {
    try {
      const config = await loadConfig();
      const client = new JiraClient(config);

      const body: { timeSpent: string; comment?: unknown; started?: string } = {
        timeSpent: opts.time,
      };
      if (opts.comment) body.comment = textToADF(opts.comment);
      if (opts.started) body.started = opts.started;

      await client.addWorklog(issueKey, body);
      console.log(`Logged ${opts.time} on ${issueKey}.`);
    } catch (err) {
      console.error(extractErrorMessage(err));
      process.exitCode = 1;
    }
  });

program
  .command("update <issueKey>")
  .description("Update fields on an existing issue")
  .option("--summary <text>", "New summary")
  .option("--description <text>", "New description")
  .option("--assignee <emailOrMe>", "New assignee email, or 'me'")
  .option("--status <name>", "Transition to this status name (e.g. 'In Progress', 'Done')")
  .action(async (issueKey, opts) => {
    try {
      const config = await loadConfig();
      const client = new JiraClient(config);

      const fields: Record<string, unknown> = {};
      if (opts.summary) fields.summary = opts.summary;
      if (opts.description) fields.description = textToADF(opts.description);
      if (opts.assignee) {
        const accountId = await resolveAssignee(client, opts.assignee, config);
        fields.assignee = { id: accountId };
      }
      if (Object.keys(fields).length > 0) {
        await client.updateIssue(issueKey, fields);
      }

      if (opts.status) {
        const transitions = await client.getTransitions(issueKey);
        const match = transitions.find(
          (t) => t.name.toLowerCase() === opts.status.toLowerCase()
        );
        if (!match) {
          throw new Error(
            `No transition named "${opts.status}" available. Options: ${transitions
              .map((t) => t.name)
              .join(", ")}`
          );
        }
        await client.transitionIssue(issueKey, match.id);
      }

      console.log(`Updated ${issueKey}.`);
    } catch (err) {
      console.error(extractErrorMessage(err));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
