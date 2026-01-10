import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InputBar } from './InputBar';
import type { Session } from '../../types/session';

async function blurViaFocusSink(editor: HTMLElement): Promise<void> {
  // `fireEvent.blur` doesn't reliably update `document.activeElement` in jsdom for contenteditable.
  // Move focus to a real focus target to trigger React's onBlur and update focus state.
  const sink = document.createElement('button');
  sink.type = 'button';
  document.body.appendChild(sink);
  sink.focus();
  await waitFor(() => expect(editor).not.toHaveFocus());
  sink.remove();
}

// Mock API
vi.mock('../../utils/api', () => ({
  API: {
    aiTools: {
      getStatus: vi.fn().mockResolvedValue({ success: true, data: {} }),
      getSettings: vi.fn().mockResolvedValue({ success: true, data: {} }),
    },
    sessions: {
      getTimeline: vi.fn().mockResolvedValue({ success: true, data: [] }),
    },
  },
}));

// Setup browser API mocks
let mockRange: any;
let mockSelection: any;

beforeEach(() => {
  // Make `innerText` behave consistently in jsdom for contenteditable handling.
  try {
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText');
    if (!desc || desc.configurable) {
      Object.defineProperty(HTMLElement.prototype, 'innerText', {
        configurable: true,
        get() {
          return this.textContent || '';
        },
        set(value: string) {
          this.textContent = value;
        },
      });
    }
  } catch {
    // best-effort
  }

  // Mock Range
  mockRange = {
    startContainer: null as Node | null,
    endContainer: null as Node | null,
    startOffset: 0,
    endOffset: 0,
    collapsed: true,
    setStart: vi.fn(function(this: any, node: Node, offset: number) {
      this.startContainer = node;
      this.startOffset = offset;
    }),
    setEnd: vi.fn(function(this: any, node: Node, offset: number) {
      this.endContainer = node;
      this.endOffset = offset;
    }),
    setStartAfter: vi.fn(function(this: any, node: Node) {
      const parent = node.parentNode;
      if (parent) {
        const index = Array.from(parent.childNodes).indexOf(node as ChildNode);
        this.startContainer = parent;
        this.startOffset = index + 1;
      }
    }),
    setEndAfter: vi.fn(function(this: any, node: Node) {
      const parent = node.parentNode;
      if (parent) {
        const index = Array.from(parent.childNodes).indexOf(node as ChildNode);
        this.endContainer = parent;
        this.endOffset = index + 1;
      }
    }),
    collapse: vi.fn(function(this: any, toStart: boolean) {
      if (toStart) {
        this.endContainer = this.startContainer;
        this.endOffset = this.startOffset;
      } else {
        this.startContainer = this.endContainer;
        this.startOffset = this.endOffset;
      }
      this.collapsed = true;
    }),
    selectNodeContents: vi.fn(function(this: any, node: Node) {
      this.startContainer = node;
      this.startOffset = 0;
      this.endContainer = node;
      this.endOffset = node.childNodes.length;
      this.collapsed = false;
    }),
    deleteContents: vi.fn(),
    insertNode: vi.fn(function(this: any, node: Node) {
      if (this.startContainer?.nodeType === Node.TEXT_NODE) {
        const textNode = this.startContainer as Text;
        const parent = textNode.parentNode;
        if (!parent) return;

        const rawOffset = typeof this.startOffset === 'number' ? this.startOffset : 0;
        const offset = Math.max(0, Math.min(rawOffset, textNode.data.length));
        const before = textNode.data.slice(0, offset);
        const after = textNode.data.slice(offset);
        textNode.data = before;

        // Insert new node between the split text nodes (mirrors real Range behavior).
        parent.insertBefore(node, textNode.nextSibling);
        if (after.length > 0) {
          const afterNode = document.createTextNode(after);
          parent.insertBefore(afterNode, node.nextSibling);
        }
        return;
      }

      if (this.startContainer) {
        this.startContainer.appendChild(node);
      }
    }),
    getBoundingClientRect: vi.fn(() => ({ top: 0, left: 0, width: 0, height: 10 })),
    getClientRects: vi.fn(() => [{ top: 0, left: 0, width: 0, height: 10 }]),
  };

  // Mock Selection
  mockSelection = {
    rangeCount: 1,
    getRangeAt: vi.fn(() => mockRange),
    removeAllRanges: vi.fn(function(this: any) {
      this.rangeCount = 0;
    }),
    addRange: vi.fn(function(this: any, range: any) {
      mockRange = range;
      this.rangeCount = 1;
    }),
  };

  // Mock window.getSelection
  global.window.getSelection = vi.fn(() => mockSelection);

  // Mock document.createRange
  global.document.createRange = vi.fn(() => {
    const newRange = { ...mockRange };
    return newRange;
  });

  // Mock window.electronAPI
  (global as any).window.electronAPI = {
    events: {
      onTimelineEvent: vi.fn(() => vi.fn()),
    },
  };

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb) => {
    cb(0);
    return 0;
  }) as any;

  // Mock cancelAnimationFrame
  global.cancelAnimationFrame = vi.fn();
});

const mockSession: Session = {
  id: 'test-session',
  name: 'test-session',
  status: 'waiting',
  createdAt: new Date().toISOString(),
  worktreePath: '/test/path',
  toolType: 'claude',
};

describe('InputBar - Cursor Position Tests', () => {
  let mockOnSend: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnToolChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSend = vi.fn();
    mockOnCancel = vi.fn();
    mockOnToolChange = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should place cursor after image tag when image is pasted', async () => {
    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;

    // Set initial content
    editor.textContent = 'hello';
    fireEvent.input(editor);

    // Move cursor to position 2 (after "he")
    const range = document.createRange();
    const textNode = editor.firstChild as Text;
    range.setStart(textNode, 2);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Blur the editor to save cursor position
    await blurViaFocusSink(editor);

    // Create a mock image file
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const clipboardData = {
      items: [
        {
          type: 'image/png',
          getAsFile: () => file,
        },
      ],
      types: [],
      getData: () => '',
    };

    // Paste image while the editor is not focused (exercise the global backup paste handler)
    fireEvent.paste(document.body, { clipboardData });

    // Wait for image to be inserted
    await waitFor(() => {
      const imageTag = editor.querySelector('[data-image-id]');
      expect(imageTag).toBeInTheDocument();
    });

    // Check cursor position - should be after image tag
    await waitFor(() => {
      const sel = window.getSelection();
      expect(sel).not.toBeNull();
      if (sel && sel.rangeCount > 0) {
        const currentRange = sel.getRangeAt(0);
        const imageTag = editor.querySelector('[data-image-id]');

        // Cursor should be after the image tag and space
        // The structure should be: textNode("he") -> imageTag -> textNode(" ") -> textNode("llo")
        // And cursor should be after the space
        expect(currentRange.startContainer).not.toBe(imageTag);

        // Verify content structure
        expect(editor.textContent).toContain('[img1]');
      }
    });
  });

  it('should hide block cursor when a selection range is active (copy-like)', async () => {
    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;
    editor.textContent = 'you can copy';
    fireEvent.input(editor);
    editor.focus();
    fireEvent.focus(editor);

    // Collapsed caret first => block cursor visible
    {
      const range = document.createRange();
      const textNode = editor.firstChild as Text;
      range.setStart(textNode, 0);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    }

    await waitFor(() => expect(screen.getByTestId('input-block-cursor')).toBeInTheDocument());

    // Create a non-collapsed selection (copy leaves selection highlighted) => block cursor hidden
    {
      const range = document.createRange();
      const textNode = editor.firstChild as Text;
      range.setStart(textNode, 0);
      range.setEnd(textNode, 3);
      (range as any).collapsed = false;
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    }

    await waitFor(() => expect(screen.queryByTestId('input-block-cursor')).not.toBeInTheDocument());
  });

  it('should move caret to end after copy', async () => {
    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;
    editor.textContent = 'copy me';
    fireEvent.input(editor);
    editor.focus();
    fireEvent.focus(editor);

    // Select a range (non-collapsed)
    const range = document.createRange();
    const textNode = editor.firstChild as Text;
    range.setStart(textNode, 0);
    range.setEnd(textNode, 4);
    (range as any).collapsed = false;
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    fireEvent.copy(editor);

    await waitFor(() => {
      const sel = window.getSelection()!;
      expect(sel.rangeCount).toBeGreaterThan(0);
      const r = sel.getRangeAt(0) as any;
      expect(r.collapsed).toBe(true);
      expect(r.startContainer?.nodeType).toBe(Node.TEXT_NODE);
      expect(r.startOffset).toBe((r.startContainer?.textContent || '').length);
    });
  });

  it('should paste at the current caret, not a stale saved position', async () => {
    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;
    editor.textContent = 'hello';
    fireEvent.input(editor);

    // Save a stale position at the end (simulates prior blur/save)
    {
      const range = document.createRange();
      const textNode = editor.firstChild as Text;
      range.setStart(textNode, 5);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      await blurViaFocusSink(editor);
    }

    // User clicks to place caret after 'h' (offset 1), then pastes.
    editor.focus();
    fireEvent.focus(editor);
    {
      const range = document.createRange();
      const textNode = editor.firstChild as Text;
      range.setStart(textNode, 1);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    }

    const clipboardData = {
      items: [],
      types: ['text/plain'],
      getData: () => 'X',
    };
    fireEvent.paste(editor, { clipboardData });

    await waitFor(() => expect(editor.textContent).toBe('hXello'));
    await waitFor(() => {
      const sel = window.getSelection()!;
      expect(sel.rangeCount).toBeGreaterThan(0);
      const r = sel.getRangeAt(0) as any;
      expect(r.collapsed).toBe(true);
      expect(r.startContainer?.nodeType).toBe(Node.TEXT_NODE);
      expect(r.startContainer?.textContent).toBe('X');
      expect(r.startOffset).toBe(1);
    });
  });

  it('should insert text at saved cursor position after blur', async () => {
    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;

    // Set initial content
    editor.textContent = 'helloworld';
    fireEvent.input(editor);

    // Move cursor to position 5 (after "hello")
    const range = document.createRange();
    const textNode = editor.firstChild as Text;
    range.setStart(textNode, 5);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Blur the editor to save cursor position
    await blurViaFocusSink(editor);

    // Simulate global keypress (typing when editor is not focused)
    const keyEvent = new KeyboardEvent('keydown', {
      key: 'X',
      bubbles: true,
    });
    document.dispatchEvent(keyEvent);

    // Wait for text to be inserted
    await waitFor(() => {
      // Text should be inserted at saved position: "helloXworld"
      expect(editor.textContent).toBe('helloXworld');
    }, { timeout: 1000 });
  });

  it('should paste text at saved cursor position after blur', async () => {
    // Mock clipboard API
    const mockClipboard = {
      readText: vi.fn().mockResolvedValue('PASTED'),
      // Force fallback to readText (jsdom doesn't fully implement async clipboard items).
      read: vi.fn().mockRejectedValue(new Error('Clipboard.read not supported in test')),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
    });

    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;

    // Set initial content
    editor.textContent = 'helloworld';
    fireEvent.input(editor);

    // Move cursor to position 5 (after "hello")
    const range = document.createRange();
    const textNode = editor.firstChild as Text;
    range.setStart(textNode, 5);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Blur the editor to save cursor position
    await blurViaFocusSink(editor);

    // Simulate Ctrl+V paste
    const pasteEvent = new KeyboardEvent('keydown', {
      key: 'v',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(pasteEvent);

    // Wait for text to be pasted
    await waitFor(() => {
      // Text should be pasted at saved position: "helloPASTEDworld"
      expect(editor.textContent).toBe('helloPASTEDworld');
    }, { timeout: 1000 });
  });

  it('should select all input content on Ctrl+A when not focused', async () => {
    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;
    editor.textContent = 'select me';
    fireEvent.input(editor);

    await blurViaFocusSink(editor);

    const selectAll = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true });
    document.dispatchEvent(selectAll);

    await waitFor(() => expect(editor).toHaveFocus());

    const sel = window.getSelection()!;
    expect(sel.rangeCount).toBeGreaterThan(0);
    const r = sel.getRangeAt(0) as any;
    expect(r.collapsed).toBe(false);
    expect(r.startContainer).toBe(editor);
  });

  it('should maintain cursor position through multiple operations', async () => {
    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;

    // Initial text
    editor.textContent = 'abc';
    fireEvent.input(editor);

    // Position cursor at index 1 (after "a")
    let range = document.createRange();
    let textNode = editor.firstChild as Text;
    range.setStart(textNode, 1);
    range.collapse(true);
    let selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Blur
    await blurViaFocusSink(editor);

    // Type "X"
    const keyEvent1 = new KeyboardEvent('keydown', { key: 'X', bubbles: true });
    document.dispatchEvent(keyEvent1);

    await waitFor(() => {
      expect(editor.textContent).toBe('aXbc');
    });

    // Focus and move cursor to end
    editor.focus();
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Blur again
    await blurViaFocusSink(editor);

    // Type "Y"
    const keyEvent2 = new KeyboardEvent('keydown', { key: 'Y', bubbles: true });
    document.dispatchEvent(keyEvent2);

    await waitFor(() => {
      expect(editor.textContent).toBe('aXbcY');
    });
  });

  it('supports ArrowUp/ArrowDown history navigation with two-step behavior', async () => {
    render(
      <InputBar
        session={mockSession}
        panelId="test-panel"
        selectedTool="claude"
        onToolChange={mockOnToolChange}
        onSend={mockOnSend}
        onCancel={mockOnCancel}
        isProcessing={false}
      />
    );

    const editor = screen.getByTestId('input-editor') as HTMLDivElement;

    // Send two messages to populate history.
    editor.textContent = 'first msg';
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: 'Enter' });
    editor.textContent = 'second msg';
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: 'Enter' });

    // Draft text.
    editor.textContent = 'draft';
    fireEvent.input(editor);
    editor.focus();
    fireEvent.focus(editor);

    // Place caret at end of draft.
    {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    }

    // First ArrowUp: move caret to start, do not change text.
    fireEvent.keyDown(editor, { key: 'ArrowUp' });
    expect(editor.textContent).toBe('draft');
    {
      const sel = window.getSelection()!;
      expect(sel.rangeCount).toBeGreaterThan(0);
      const r = sel.getRangeAt(0) as any;
      expect(r.collapsed).toBe(true);
      expect(r.startOffset).toBe(0);
    }

    // Second ArrowUp (already at start): load most recent history.
    fireEvent.keyDown(editor, { key: 'ArrowUp' });
    expect(editor.textContent).toBe('second msg');

    // ArrowUp again: older history.
    fireEvent.keyDown(editor, { key: 'ArrowUp' });
    expect(editor.textContent).toBe('first msg');

    // ArrowDown: back toward newer.
    fireEvent.keyDown(editor, { key: 'ArrowDown' });
    expect(editor.textContent).toBe('second msg');

    // ArrowDown at newest: restore draft and exit history.
    fireEvent.keyDown(editor, { key: 'ArrowDown' });
    expect(editor.textContent).toBe('draft');

    // If caret is already at start (e.g. user clicked to start), first ArrowUp should still be a no-op,
    // and only the second ArrowUp should enter history.
    editor.textContent = 'draft';
    fireEvent.input(editor);
    {
      const range = document.createRange();
      const textNode = editor.firstChild as Text;
      range.setStart(textNode, 0);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    }

    // Reset priming by pressing a non-arrow key.
    fireEvent.keyDown(editor, { key: 'Shift' });

    fireEvent.keyDown(editor, { key: 'ArrowUp' });
    expect(editor.textContent).toBe('draft');
    fireEvent.keyDown(editor, { key: 'ArrowUp' });
    expect(editor.textContent).toBe('second msg');
  });
});
