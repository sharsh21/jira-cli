---
name: log-jira
description: Summarize the work done in this session and log it to Jira Cloud — create a task/story/subtask or log a worklog against an existing issue, using the jira-cli tool.
---

# log-jira

Use this skill when the user asks to "log this to jira", "log jira", "create a ticket for this", or similar, after doing work in the current session.

This skill wraps a local CLI tool called `jira-cli` (a Node/TypeScript tool from the [jira-cli](../../README.md) repository, installed globally via `npm link`). It talks to Jira Cloud's REST API v3. Credentials live in `~/.jira-cli/config.json`, set up via `jira-cli config init`. Because `jira-cli` is a global command, this skill works from any project directory.

## Steps

1. **Check setup.** Run `jira-cli whoami`. If it fails because no config exists, tell the user to run `jira-cli config init` (interactive: base URL, email, API token, default project key) and stop — do not proceed until it succeeds.

2. **Draft a summary.** From the current conversation, write a 1-3 sentence summary of what was actually done (files changed, bug fixed, feature added). Don't ask the user for this — derive it yourself from context. Show it to the user as part of your questions so they can correct it.

3. **Ask the clarifying questions** (use `AskUserQuestion`, batched into as few questions as possible, only asking what you can't infer):
   - **Target**: log work against an **existing issue** (ask for the issue key) or **create a new issue**?
   - If creating: **issue type** (Task / Story / Bug), and **standalone or subtask** (if subtask, ask for the parent issue key).
   - **Original time estimate** — always ask this when creating a new issue (e.g. `2h`, `1d`), it's easy to forget and the CLI won't set one on its own. Only skip asking if the user has already stated it or explicitly says no estimate.
   - **Time spent** (for the worklog) — e.g. `1h30m`.
   - **Assignee** — default to `me` unless told otherwise.

4. **Run the CLI** via Bash, in order:
   - To create an issue:
     `jira-cli create --type <Task|Story|Bug> --summary "<summary>" --description "<full summary/details>" [--parent <KEY>] [--assignee <email-or-me>] [--time <estimate>]`
     This prints the new issue key and URL — capture the key for the next step.
   - To log work (always, once you have an issue key — new or existing), explicitly pass `--started` set to today's date at the current local time in ISO 8601 (e.g. via `date -Iseconds`) so the worklog's start date is today rather than silently relying on the CLI's own default:
     `jira-cli log-work <ISSUE-KEY> --time <timeSpent> --comment "<summary>" --started "<today's ISO 8601 datetime>"`
   - To reassign or change status on an existing issue, use `jira-cli update <ISSUE-KEY> --assignee <email-or-me> --status "<Status Name>"` as needed.

5. **Report back** the issue key, its URL, and what was logged (estimate/time/assignee). If any CLI call fails, show the actual error message from the tool — don't guess at the cause.

## Notes
- Never invent an issue key, project key, or accountId — these must come from the user or from a CLI call's output.
- Time strings must be in Jira format: `w`/`d`/`h`/`m` (e.g. `3h 30m`, `1d`), not "1.5 hours".
- Project key defaults to the one set in `jira-cli config init` if the user doesn't specify one and it's ambiguous, ask.
