import { Extension } from '@tiptap/core';

/**
 * Find the start position of the previous word from the given position
 */
function findPrevWordStart(doc: any, pos: number): number {
  const text = doc.textBetween(0, pos, '\n', ' ');

  if (pos === 0) return 0;

  let start = pos - 1;

  // Skip trailing whitespace
  while (start >= 0 && /\s/.test(text[start])) {
    start--;
  }

  // Skip word characters
  while (start >= 0 && !/\s/.test(text[start])) {
    start--;
  }

  return Math.max(0, start + 1);
}

/**
 * TerminalShortcuts extension for Tiptap
 * Provides terminal-like keyboard shortcuts:
 * - Ctrl+W: Delete previous word
 * - Ctrl+U: Delete from cursor to start
 * - Ctrl+K: Delete from cursor to end
 * - Ctrl+E: Move cursor to end
 * - Ctrl+A: Move cursor to start
 */
export const TerminalShortcuts = Extension.create({
  name: 'terminalShortcuts',

  addKeyboardShortcuts() {
    return {
      // Ctrl+W: Delete previous word
      'Ctrl-w': ({ editor }) => {
        const { state, view } = editor;
        const { from } = state.selection;

        if (from === 0) return true;

        const wordStart = findPrevWordStart(state.doc, from);

        const tr = state.tr.delete(wordStart, from);
        view.dispatch(tr);

        return true;
      },

      // Ctrl+U: Delete from cursor to start of content
      'Ctrl-u': ({ editor }) => {
        const { state, view } = editor;
        const { from } = state.selection;

        if (from === 0) return true;

        const tr = state.tr.delete(0, from);
        view.dispatch(tr);

        return true;
      },

      // Ctrl+K: Delete from cursor to end of content
      'Ctrl-k': ({ editor }) => {
        const { state, view } = editor;
        const { from } = state.selection;
        const end = state.doc.content.size;

        if (from >= end) return true;

        const tr = state.tr.delete(from, end);
        view.dispatch(tr);

        return true;
      },

      // Ctrl+E: Move cursor to end
      'Ctrl-e': ({ editor }) => {
        return editor.commands.focus('end');
      },

      // Ctrl+A: Move cursor to start
      'Ctrl-a': ({ editor }) => {
        return editor.commands.focus('start');
      },
    };
  },
});
