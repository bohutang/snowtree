# Snowtree

**Review-Driven Safe AI Coding**

Snowtree is a workflow manager for AI coding sessions. It keeps your main codebase safe by running AI agents in isolated **git worktrees**, allowing you to review, edit, and stage changes incrementally before merging.

![Snowtree Demo](assets/snowtree-show.gif)

## Why Snowtree?

AI coding agents are powerful but can be unpredictable. Snowtree solves the "undo" problem:

*   **Isolation**: Every AI session runs in its own detached environment. Your main working directory remains untouched until you're ready.
*   **Incremental Review**: Review code after every AI prompt. "Stage" the changes you like to create a new baseline for the next prompt.
*   **Safety**: Revert bad generations instantly without losing your progress or messing up your git history.

## Features

*   **Worktree Isolation**: Spike multiple features or refactors in parallel with zero context switching costs.
*   **Native Agent Support**: Use `claude-code`, `codex`, or other CLI agents directly. No wrappers, no proxies.
*   **Smart Staging**: Staged files act as the "truth" for the AI's next step, preventing it from undoing your fixes.
*   **Auto-Sync**: Automatically handles upstream updates, PR creation, and conflict resolution.

## Installation

### Prerequisites

Snowtree orchestrates CLI-based AI agents. You must have at least one installed:

*   **Claude Code**: `npm install -g @anthropic-ai/claude-code`
*   **Codex**: `npm install -g @openai/codex`

### Install Snowtree

**macOS / Linux (One-line)**

```bash
curl -fsSL https://raw.githubusercontent.com/databendlabs/snowtree/main/install.sh | sh
```

**Manual Download**

Pre-built binaries for macOS (`.dmg`) and Linux (`.deb`, `.AppImage`) are available on [GitHub Releases](https://github.com/databendlabs/snowtree/releases).

## Development

To build Snowtree from source, you need `node >= 22.14` and `pnpm`.

```bash
make install   # Install dependencies
make run       # Start the development app
make check     # Run typechecks, linting, and tests
make build     # Build all packages
```

## Learn More

*   [Blog: Snowtree - Review-Driven Safe AI Coding](https://www.bohutang.me/2026/01/10/snowtree-review-driven-safe-ai-coding/)

## License

Apache-2.0