import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';

export interface InputHistoryOptions {
  /**
   * Callback to get history entries
   */
  getHistory: () => string[];

  /**
   * Callback when navigating history
   */
  onNavigate?: (text: string, index: number | null) => void;
}

interface InputHistoryStorage {
  historyIndex: number | null;
  draftBeforeHistory: string;
  navPrimed: 'up' | 'down' | null;
  isNavigating: boolean; // True when currently browsing history
}

const InputHistoryPluginKey = new PluginKey<InputHistoryStorage>('inputHistory');

/**
 * InputHistory extension for Tiptap
 * Provides shell-like input history navigation with ArrowUp/Down:
 * - First press: Move cursor to boundary
 * - Second press: Navigate through history
 */
export const InputHistory = Extension.create<InputHistoryOptions, InputHistoryStorage>({
  name: 'inputHistory',

  addOptions() {
    return {
      getHistory: () => [],
      onNavigate: undefined,
    };
  },

  addStorage() {
    return {
      historyIndex: null,
      draftBeforeHistory: '',
      navPrimed: null,
      isNavigating: false,
    };
  },

  addCommands() {
    return {}; // No custom commands needed
  },

  addKeyboardShortcuts() {
    return {
      ArrowUp: ({ editor }) => {
        const history = this.options.getHistory();
        if (history.length === 0) return false;

        const { historyIndex, navPrimed } = this.storage;
        const inHistory = historyIndex !== null;
        const direction = 'up';
        const currentText = editor.getText();
        const isEmpty = currentText.trim().length === 0;

        // Helper: Navigate to previous history entry
        const goPrev = () => {
          if (this.storage.historyIndex === null) {
            this.storage.draftBeforeHistory = editor.getText();
            this.storage.historyIndex = history.length - 1;
            this.storage.isNavigating = true;
          } else if (this.storage.historyIndex > 0) {
            this.storage.historyIndex -= 1;
          }

          const idx = this.storage.historyIndex;
          if (idx === null) return;

          const text = history[idx];
          this.storage.isNavigating = true;
          editor.commands.setContent(text);
          editor.commands.focus('end');
          this.storage.isNavigating = false;

          if (this.options.onNavigate) {
            this.options.onNavigate(text, idx);
          }
        };

        // While browsing history, ArrowUp always navigates
        if (inHistory) {
          this.storage.navPrimed = direction;
          goPrev();
          return true;
        }

        // If empty, directly enter history on first press
        if (isEmpty) {
          this.storage.navPrimed = direction;
          goPrev();
          return true;
        }

        // Two-step behavior when there is content:
        // First press moves to boundary, second navigates
        const { from, to } = editor.state.selection;
        const startPos = Selection.atStart(editor.state.doc).from;
        const atBoundary = (from === to && from === startPos);

        // If not at boundary, move to boundary and prime navigation
        if (!atBoundary) {
          this.storage.navPrimed = direction;
          editor.commands.focus('start');
          return true;
        }

        // At boundary: if already primed for this direction, enter history
        if (navPrimed === direction) {
          goPrev();
          return true;
        }

        // At boundary but not primed yet: prime for next press
        this.storage.navPrimed = direction;
        return true;
      },

      ArrowDown: ({ editor }) => {
        const history = this.options.getHistory();
        if (history.length === 0) return false;

        const { historyIndex } = this.storage;
        const inHistory = historyIndex !== null;
        const direction = 'down';
        const currentText = editor.getText();
        const isEmpty = currentText.trim().length === 0;

        // Helper: Navigate to next history entry or restore draft
        const goNext = () => {
          if (this.storage.historyIndex === null) return;

          if (this.storage.historyIndex < history.length - 1) {
            this.storage.historyIndex += 1;
            const text = history[this.storage.historyIndex];
            this.storage.isNavigating = true;
            editor.commands.setContent(text);
            editor.commands.focus('end');
            this.storage.isNavigating = false;

            if (this.options.onNavigate) {
              this.options.onNavigate(text, this.storage.historyIndex);
            }
            return;
          }

          // Past the newest entry => restore draft and exit history
          this.storage.historyIndex = null;
          this.storage.isNavigating = false;
          const draft = this.storage.draftBeforeHistory;
          this.storage.draftBeforeHistory = '';
          this.storage.isNavigating = true;
          editor.commands.setContent(draft);
          editor.commands.focus('end');
          this.storage.isNavigating = false;

          if (this.options.onNavigate) {
            this.options.onNavigate(draft, null);
          }
        };

        // While browsing history, ArrowDown always navigates
        if (inHistory) {
          this.storage.navPrimed = direction;
          goNext();
          return true;
        }

        // If empty and not in history, nothing to do
        if (isEmpty) {
          return true;
        }

        // Two-step behavior when there is content
        const { from, to } = editor.state.selection;
        const endPos = Selection.atEnd(editor.state.doc).to;
        const atEnd = (from === to && from === endPos);

        // If not at boundary, move to boundary and prime navigation
        if (!atEnd) {
          this.storage.navPrimed = direction;
          editor.commands.focus('end');
          return true;
        }

        // At boundary but not in history: nothing to do
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const exitHistoryMode = () => {
      if (this.storage.historyIndex === null && this.storage.navPrimed === null) {
        return;
      }
      this.storage.historyIndex = null;
      this.storage.navPrimed = null;
      this.storage.draftBeforeHistory = '';
      this.storage.isNavigating = false;
    };

    return [
      new Plugin({
        key: InputHistoryPluginKey,
        props: {
          handleKeyDown: (_view, event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
              this.storage.navPrimed = null;
            }

            if (this.storage.historyIndex !== null) {
              if (event.key === 'Backspace' || event.key === 'Delete') {
                exitHistoryMode();
              }
            }

            return false;
          },
          handleTextInput: () => {
            if (this.storage.historyIndex !== null) {
              exitHistoryMode();
            }
            return false;
          },
          handlePaste: () => {
            if (this.storage.historyIndex !== null) {
              exitHistoryMode();
            }
            return false;
          },
          handleDrop: () => {
            if (this.storage.historyIndex !== null) {
              exitHistoryMode();
            }
            return false;
          },
        },
        state: {
          init: () => this.storage,
          apply: (tr, value) => {
            const newState = value;

            if (tr.docChanged && !this.storage.isNavigating) {
              exitHistoryMode();
            }

            return newState;
          },
        },
      }),
    ];
  },
});
