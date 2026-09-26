# jira-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

Log your work to Jira Cloud from the terminal, or let [Claude Code](https://claude.com/claude-code) do it for you with the `/log-jira` skill.

```
You:     /log-jira
Claude:  Summary: "Fixed the SSO login redirect; added a regression test."
         New issue or existing? Type? Estimate? Time spent?
You:     New Bug, estimate 2h, spent 1h30m
Claude:  Created ENG-123 and logged 1h30m.
```

## Install

You need Node.js 18+, a Jira Cloud site, and an [API token](https://id.atlassian.com/manage-profile/security/api-tokens).

```bash
git clone https://github.com/sharsh21/jira-cli.git
cd jira-cli
npm install && npm run build && npm link

jira-cli config init    # enter your Jira URL, email, API token, and default project
jira-cli whoami         # check that it works
```

### Add the Claude Code skill (optional)

```bash
mkdir -p ~/.claude/skills
cp -r skills/log-jira ~/.claude/skills/
```

Restart Claude Code. After you finish a piece of work, type `/log-jira`.

## Usage

```bash
jira-cli create --summary "Fix login redirect" --type Bug --time 2h --assignee me
jira-cli create --summary "Add tests" --parent ENG-123          # subtask
jira-cli log-work ENG-123 --time 1h30m --comment "Patched redirect logic"
jira-cli update ENG-123 --status "In Progress"
```

Run `jira-cli <command> --help` to see every option.

## Security

Your credentials are saved to `~/.jira-cli/config.json` on your machine. Don't share or commit that file. The CLI only talks to the Jira site you configure.

## Contributing

Issues and pull requests are welcome.

## License

[MIT](LICENSE) © 2026 Harsh Shah

*Not affiliated with Atlassian or Anthropic. Jira is a trademark of Atlassian.*
