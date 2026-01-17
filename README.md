# Snowtree

> **Review-driven workflow for safe, auditable, and merge-ready AI coding.**

Snowtree isolates AI coding sessions into Git worktrees, enabling parallel experimentation and incremental reviews without polluting your main branch.

![Snowtree Demo](assets/snowtree-show.gif)

## Why Snowtree?

AI generates code fast, but reviewing it is hard. Snowtree solves the "too much to review" problem:

-   **Worktree Isolation:** Every session runs in its own Git worktree. Spike multiple ideas in parallel with zero merge conflicts.
-   **Incremental Review:** Review, stage, and lock in changes after each AI round. Subsequent iterations only diff against your staged baseline.
-   **Native CLI Agents:** Run tools like **Claude Code** or **Codex** directly—no wrappers, queues, or limits.
-   **Stage-as-Snapshot:** Staged files become the canonical truth. Merge and ship only when you're ready.

## Capabilities

Snowtree automates the tedious parts of the loop:
*   **Writes Code:** Edits live in isolation while you review.
*   **Auto-Commits:** Generates semantic commit messages for staged snapshots.
*   **Syncs PRs:** Opens or refreshes pull requests on demand.
*   **Upstream Sync:** Rebases/merges latest changes from `main`.
*   **Conflict Resolution:** Fixes merge conflicts automatically.

## Prerequisites

Ensure you have at least one AI agent installed:

| Agent | Installation |
|-------|--------------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `npm install -g @anthropic-ai/claude-code` |
| [Codex](https://github.com/openai/codex) | `npm install -g @openai/codex` |

## Installation

### One-line Installer (macOS/Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/databendlabs/snowtree/main/install.sh | sh
```

### Manual Download

Visit [GitHub Releases](https://github.com/databendlabs/snowtree/releases) for:
-   **macOS:** `.dmg` (arm64, x64)
-   **Linux:** `.deb`, `.AppImage` (x86_64)

## Development

```bash
make install   # Install dependencies
make run       # Start development server
make check     # Typecheck, lint, and test
make build     # Build packages
```

## Resources

-   [Blog: Snowtree - Review-Driven Safe AI Coding](https://www.bohutang.me/2026/01/10/snowtree-review-driven-safe-ai-coding/)

## License

Apache-2.0