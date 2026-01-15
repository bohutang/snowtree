# Block Caret Design (InputBar)

## Goal
Render a block-style caret in the InputBar editor that visually matches the
terminal-like cursor shown in the reference screenshot, without affecting other
editors or panels.

## Scope
- InputBar editor only (Tiptap / ProseMirror).
- Block caret shows when focused and selection is collapsed.

Out of scope: other editors, diff viewers, timeline panels, and global cursor
behavior.

## Approach
Add a Tiptap extension that inserts a ProseMirror decoration widget at the
current selection when the editor is focused. The widget is a `span` with a
CSS-driven block style. The native caret is hidden via `caret-color: transparent`
so the block caret is the only cursor displayed. The block caret uses
`currentColor` so it tracks existing text color (including faint/disabled state).

Focus and composition state are tracked via DOM events on the editor view to
avoid rendering the block caret during IME composition. The widget is inserted
only when the selection is collapsed.

## Styling
Define `.st-block-caret` styles within the Tiptap editor scope. The caret is
rendered using a zero-width element with a pseudo-element that draws the block.
Blinking uses a CSS animation with a configurable duration fallback
(`var(--st-caret-blink, 1s)`), with reduced-motion disabling the animation.

## Testing
Add a UI test in `InputBar.test.tsx` that focuses the editor and asserts the
block caret element is present. This test fails before the extension is added
and passes afterward.
