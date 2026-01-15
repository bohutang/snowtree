import { Node, mergeAttributes } from '@tiptap/core';

export interface ImagePillOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface ImagePillAttributes {
  id: string;
  index: number;
  filename: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imagePill: {
      /**
       * Insert an image pill
       */
      insertImagePill: (attributes: ImagePillAttributes) => ReturnType;
    };
  }
}

/**
 * ImagePill node extension for Tiptap
 * Renders inline image attachments as contentEditable=false pills
 * Example: [img1], [img2], etc.
 */
export const ImagePill = Node.create<ImagePillOptions>({
  name: 'imagePill',

  group: 'inline',

  inline: true,

  // atom: true makes this node behave like contentEditable=false
  // It cannot be split or modified, only selected and deleted as a whole
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-image-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return {
            'data-image-id': attributes.id,
          };
        },
      },
      index: {
        default: 1,
        parseHTML: element => {
          const text = element.textContent || '';
          const match = text.match(/\[img(\d+)\]/);
          return match ? parseInt(match[1], 10) : 1;
        },
      },
      filename: {
        default: '',
        parseHTML: element => element.getAttribute('data-filename'),
        renderHTML: attributes => {
          if (!attributes.filename) {
            return {};
          }
          return {
            'data-filename': attributes.filename,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-image-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const index = HTMLAttributes.index || 1;
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'image-pill',
        contenteditable: 'false',
        style: `
          display: inline-block;
          padding: 2px 6px;
          margin: 0 2px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
          background-color: color-mix(in srgb, var(--st-accent) 15%, transparent);
          color: var(--st-accent);
          user-select: all;
          cursor: default;
        `,
      }),
      `[img${index}]`,
    ];
  },

  addCommands() {
    return {
      insertImagePill:
        attributes =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: attributes,
            })
            .insertContent(' ') // Add space after pill
            .run();
        },
    };
  },
});
