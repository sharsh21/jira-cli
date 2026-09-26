# Changelog

All notable changes to this project are documented here. This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- `log-work` now sends the start time in the format Jira requires, and always sends one (defaulting to now).
- Subtasks now use the project's own subtask type, so they work on team-managed projects too.
- `--assignee` no longer silently picks the first partial match when several users match.
- `update` with no options now reports an error instead of claiming success.
- A bad `--status` name now fails before any other field is changed.

### Changed
- The API token is hidden while you type it in `config init`, and existing settings are offered as defaults.
- Issue keys, durations, dates and the Jira URL are validated before any request is sent.
- Clearer error messages for authentication, permission and network failures.
- Requires Node.js 20 or later.

### Added
- `jira-cli --version`.
- Unit tests (`npm test`) and GitHub Actions CI.

## [0.1.0] - 2026-09-26

First release.

[Unreleased]: https://github.com/sharsh21/jira-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sharsh21/jira-cli/releases/tag/v0.1.0
