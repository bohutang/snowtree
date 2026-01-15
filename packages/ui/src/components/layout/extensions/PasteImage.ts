import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/tiff'];

export interface PasteImageOptions {
  /**
   * Callback when an image is pasted
   * The handler should process the file and call editor.commands.insertImagePill
   */
  onImagePaste?: (file: File) => void | Promise<void>;
}

/**
 * PasteImage extension for Tiptap
 * Intercepts paste events containing images and delegates to a callback handler
 */
export const PasteImage = Extension.create<PasteImageOptions>({
  name: 'pasteImage',

  addOptions() {
    return {
      onImagePaste: undefined,
    };
  },

  addProseMirrorPlugins() {
    const onImagePaste = this.options.onImagePaste;

    return [
      new Plugin({
        key: new PluginKey('pasteImage'),
        props: {
          handlePaste: (view, event) => {
            if (!onImagePaste) {
              return false;
            }

            const clipboardData = event.clipboardData;
            if (!clipboardData) {
              return false;
            }

            const items = Array.from(clipboardData.items);
            const imageItems = items.filter((item) =>
              ACCEPTED_IMAGE_TYPES.includes(item.type)
            );

            if (imageItems.length === 0) {
              return false; // Let Tiptap handle text paste
            }

            // Prevent default and handle images
            event.preventDefault();

            // Process all pasted images
            imageItems.forEach((item) => {
              const file = item.getAsFile();
              if (file) {
                void onImagePaste(file);
              }
            });

            // Also handle text if present (after images)
            if (clipboardData.types.includes('text/plain')) {
              const text = clipboardData.getData('text/plain');
              if (text) {
                // Insert text at current position
                view.dispatch(
                  view.state.tr.insertText(text, view.state.selection.from)
                );
              }
            }

            return true; // Event handled
          },
        },
      }),
    ];
  },
});
