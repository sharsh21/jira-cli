# jira-cli + `/log-jira` Claude Code skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

**Log your coding sessions to Jira without leaving the terminal.**

This repo contains two things that work together:

1. **`jira-cli`** — a small, dependency-light Node/TypeScript command-line tool for Jira Cloud. Create tasks, stories, bugs and subtasks, log work, reassign issues, and move them through the workflow.
2. **`/log-jira`** — a [Claude Code](https://claude.com/claude-code) skill (in [`skills/log-jira`](skills/log-jira/SKILL.md)). After you've done some work with Claude, type `/log-jira`. Claude writes a summary of what was done, asks a few quick questions (new issue or existing one, type, estimate, time spent), then runs `jira-cli` to create the ticket and log the work.

You can use the CLI on its own. The skill needs the CLI.

```
You:     /log-jira
Claude:  Summary: "Fixed the SSO login redirect that sent users to /404; added a regression test."
         → New issue or existing? Type? Estimate? Time spent?
You:     New Bug, estimate 2h, spent 1h30m
Claude:  Created ENG-123: https://yoursite.atlassian.net/browse/ENG-123
         Logged 1h30m on ENG-123.
```

---

## Features

- Create **Task / Story / Bug** issues, or **subtasks** under a parent
- Set the **original time estimate** and **assignee** (`me` or any email) at creation time
- Add **worklogs** with a comment and a start time
- **Update** summary, description, assignee, and **transition status** by name
- Credentials are verified before they're saved, and stored locally with `600` permissions
- Talks only to your own Jira Cloud site (REST API v3). No telemetry, no third parties.

## Requirements

- **Node.js 18+** and npm
- A **Jira Cloud** site (e.g. `https://yoursite.atlassian.net`)
- A **Jira API token**, created at <https://id.atlassian.com/manage-profile/security/api-tokens>
- *(For the skill)* **Claude Code** installed: <https://docs.claude.com/en/docs/claude-code>

---

## Quick start (step by step)

### Step 1: Clone and install the CLI

```bash
git clone https://github.com/<your-username>/jira-cli.git
cd jira-cli
npm install
npm run build
npm link        # puts `jira-cli` on your PATH globally
```

Check that it installed:

```bash
jira-cli --help
```

> If you change the source later, run `npm run build` again. You don't need to re-run `npm link`, because the global command already points at this directory.

### Step 2: Connect it to Jira

```bash
jira-cli config init
```

You'll be prompted for:

| Prompt | Example |
|---|---|
| Jira base URL | `https://yoursite.atlassian.net` |
| Your Jira account email | `you@company.com` |
| API token | *(paste the token from id.atlassian.com)* |
| Default project key (optional) | `ENG` |

The CLI checks the credentials against Jira's `/myself` endpoint before saving them to `~/.jira-cli/config.json`. That file is readable only by you (`chmod 600`).

Check the connection:

```bash
jira-cli whoami          # shows your Jira user if auth works
jira-cli config path     # prints the config file location
```

### Step 3: Install the `/log-jira` skill in Claude Code

Claude Code finds skills in a `skills/` folder. Each skill is a directory with a `SKILL.md` file. Pick **one** of these:

**Option A: For all your projects (recommended)**

```bash
mkdir -p ~/.claude/skills
cp -r skills/log-jira ~/.claude/skills/
```

**Option B: Symlink, so `git pull` keeps the skill up to date**

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)/skills/log-jira" ~/.claude/skills/log-jira
```

**Option C: For a single project only**

```bash
mkdir -p /path/to/your-project/.claude/skills
cp -r skills/log-jira /path/to/your-project/.claude/skills/
```

The resulting layout should look like this:

```
~/.claude/skills/
  log-jira/
    SKILL.md
```

### Step 4: Load the skill

Claude Code reads skills when a session starts:

1. **Start a new Claude Code session**, or restart one that's already running, by running `claude` in any project.
2. Type `/` and look for **`log-jira`** in the list. If it shows up, the skill is loaded.
3. You can also ask Claude *"what skills do you have?"*, and `log-jira` should be listed.

If it doesn't show up, see [Troubleshooting](#troubleshooting).

### Step 5: Use it

1. Work on something with Claude Code as usual, such as fixing a bug or building a feature.
2. When you're done, type **`/log-jira`**, or just say *"log this to jira"*.
3. Claude will:
   1. Run `jira-cli whoami` to check your setup. If no config exists yet, it tells you to run `jira-cli config init` and stops.
   2. **Write a 1–3 sentence summary** of the work from the conversation.
   3. **Ask you** for anything it can't work out on its own:
      - Log against an **existing issue** (you give the key) or **create a new one**
      - Issue **type** (Task / Story / Bug), and whether it's a **subtask** (and of which parent)
      - **Original estimate** (e.g. `2h`, `1d`)
      - **Time spent** (e.g. `1h30m`)
      - **Assignee** (defaults to `me`)
   4. Run `jira-cli create` if needed, then `jira-cli log-work` with today's date as the start time.
   5. **Report back** with the issue key, a link to it, and what was logged.

Claude never makes up issue keys, project keys, or account IDs. They come from you or from the CLI's output. If a command fails, Claude shows the error the CLI printed.

---

## CLI reference

### `jira-cli create`: create an issue

```bash
jira-cli create --summary "Fix login redirect bug" \
  --type Bug \
  --description "Users were redirected to /404 after SSO login." \
  --project ENG \
  --assignee me \
  --time 2h
```

| Option | Description |
|---|---|
| `--summary <text>` | **Required.** Issue title |
| `--type <type>` | `Task`, `Story`, or `Bug` (default `Task`) |
| `--project <key>` | Project key; defaults to `defaultProjectKey` from config |
| `--description <text>` | Plain text description (converted to Atlassian Document Format) |
| `--assignee <emailOrMe>` | An email address, or `me` |
| `--time <estimate>` | Original estimate in Jira format (`2h`, `1d`, `30m`) |
| `--parent <KEY>` | Creates a **subtask** under this parent (sets the type to `Sub-task`) |

Output:

```
Created ENG-123: https://yoursite.atlassian.net/browse/ENG-123
```

#### Subtasks

```bash
jira-cli create --summary "Write unit tests for redirect fix" \
  --parent ENG-123 --assignee me --time 1h
```

### `jira-cli log-work <KEY>`: log time

```bash
jira-cli log-work ENG-123 --time 1h30m \
  --comment "Investigated and patched the redirect logic" \
  --started "$(date -Iseconds)"
```

| Option | Description |
|---|---|
| `--time <duration>` | **Required.** Time spent (`1h30m`, `45m`, `2d`) |
| `--comment <text>` | Worklog comment |
| `--started <iso>` | ISO 8601 start time; defaults to now |

### `jira-cli update <KEY>`: edit or transition

```bash
jira-cli update ENG-123 --status "In Progress"
jira-cli update ENG-123 --assignee jane@company.com
jira-cli update ENG-123 --summary "New summary" --description "New description"
```

`--status` must match the name of a transition available for that issue (case doesn't matter). If it doesn't match, the error lists the valid options.

### Other commands

| Command | Description |
|---|---|
| `jira-cli config init` | Interactive setup |
| `jira-cli config path` | Print the config file location |
| `jira-cli whoami` | Check credentials and show the logged-in user |

> **Time format:** Jira expects `w` / `d` / `h` / `m` units, for example `3h 30m` or `1d`. Values like `1.5 hours` won't work.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `jira-cli: command not found` | Run `npm link` in the repo, and make sure npm's global bin directory is on your `PATH` (`npm prefix -g`) |
| `No config found at ~/.jira-cli/config.json` | Run `jira-cli config init` |
| 401 / 403 errors | The API token is wrong or revoked, or the email doesn't match. Re-run `config init` |
| `No Jira user found matching "..."` | `--assignee` must be `me` or the email of a real Jira user |
| `No transition named "..." available` | Use one of the transition names listed in the error |
| `/log-jira` doesn't appear in Claude Code | Check that the path is exactly `~/.claude/skills/log-jira/SKILL.md` (or `<project>/.claude/skills/...`), then **restart** the Claude Code session |
| The skill runs but the CLI fails | Run `jira-cli whoami` in the same terminal to confirm the CLI works outside Claude |

## Security

- Your API token is stored in plain text at `~/.jira-cli/config.json` with `600` permissions. Treat that file like a password, and never commit it.
- The CLI only makes requests to the Jira base URL you configure.
- To revoke access, delete the token at id.atlassian.com and remove `~/.jira-cli/config.json`.

## Project layout

```
jira-cli/
├── src/
│   ├── cli.ts           # entry point & command definitions (commander)
│   ├── config.ts        # reads/writes ~/.jira-cli/config.json
│   ├── jiraClient.ts    # thin wrapper around Jira REST API v3
│   └── adf.ts           # plain text → Atlassian Document Format
├── skills/
│   └── log-jira/
│       └── SKILL.md     # the Claude Code skill
├── dist/                # compiled output (git-ignored)
├── LICENSE
└── README.md
```

## Contributing

Issues and pull requests are welcome.

1. Fork the repo and create a branch: `git checkout -b feature/my-change`
2. Make your changes in `src/` (or `skills/log-jira/SKILL.md`)
3. Run `npm run build` and test against a Jira sandbox project
4. Open a pull request that describes what you changed and why

Ideas: support for Jira Server/Data Center, JQL search, custom fields, labels and components, and more skill workflows.

## License

[MIT](LICENSE) © 2026 Harsh Shah

*This is an independent project. It is not affiliated with or endorsed by Atlassian or Anthropic. Jira is a trademark of Atlassian.*
