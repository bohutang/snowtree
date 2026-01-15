/**
 * ClaudeMessageParser - Parse Claude stream-json messages into normalized entries
 * Inspired by vibe-kanban's normalize_logs implementation
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ClaudeMessage,
  ClaudeContentItem,
  ClaudeStreamEvent,
  NormalizedEntry,
  NormalizedEntryType,
  ActionType,
} from '../types';

interface StreamingState {
  messageId?: string;
  contentBlocks: Map<number, ClaudeContentItem>;
  currentText: string;
  currentThinking: string;
}

/**
 * Parses Claude stream-json messages into normalized entries for UI display
 */
export class ClaudeMessageParser {
  private streamingState: StreamingState = {
    contentBlocks: new Map(),
    currentText: '',
    currentThinking: '',
  };

  /**
   * Parse a Claude message into a normalized entry
   */
  parseMessage(message: ClaudeMessage): NormalizedEntry | null {
    const timestamp = new Date().toISOString();

    switch (message.type) {
      case 'system':
        return this.parseSystemMessage(message, timestamp);

      case 'user':
        return this.parseUserMessage(message, timestamp);

      case 'assistant':
        return this.parseAssistantMessage(message, timestamp);

      case 'tool_use':
        return this.parseToolUseMessage(message, timestamp);

      case 'tool_result':
        return this.parseToolResultMessage(message, timestamp);

      case 'stream_event':
        return this.parseStreamEvent(message, timestamp);

      case 'result':
        return this.parseResultMessage(message, timestamp);

      default:
        return null;
    }
  }

  private parseSystemMessage(
    message: Extract<ClaudeMessage, { type: 'system' }>,
    timestamp: string
  ): NormalizedEntry | null {
    const subtype = message.subtype || 'info';

    // Skip init messages unless they contain useful info
    if (subtype === 'init') {
      return {
        id: uuidv4(),
        timestamp,
        entryType: 'system_message',
        content: `Session initialized`,
        metadata: {
          session_id: message.session_id,
          cwd: message.cwd,
          model: message.model,
        },
      };
    }

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'system_message',
      content: `System: ${subtype}`,
      metadata: message as unknown as Record<string, unknown>,
    };
  }

  private parseUserMessage(
    message: Extract<ClaudeMessage, { type: 'user' }>,
    timestamp: string
  ): NormalizedEntry {
    const content = this.extractTextContent(message.message?.content || []);

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'user_message',
      content,
    };
  }

  private parseAssistantMessage(
    message: Extract<ClaudeMessage, { type: 'assistant' }>,
    timestamp: string
  ): NormalizedEntry | null {
    const contentItems = message.message?.content || [];
    const textContent = this.extractTextContent(contentItems);
    const stopReason = message.message?.stop_reason;

    // Detect partial messages: when using --include-partial-messages,
    // partial messages have stop_reason: null, final messages have stop_reason: "end_turn"
    const isStreaming = !stopReason || stopReason === null;

    // Skip streaming assistant messages with no text content (likely tool_use only)
    // We already track text streaming via stream_event content_block_delta
    if (isStreaming && !textContent.trim()) {
      return null;
    }

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'assistant_message',
      content: textContent,
      metadata: {
        model: message.message?.model,
        stop_reason: stopReason,
        streaming: isStreaming,
      },
    };
  }

  private parseToolUseMessage(
    message: Extract<ClaudeMessage, { type: 'tool_use' }>,
    timestamp: string
  ): NormalizedEntry {
    const toolName = message.tool_name || 'unknown';
    const toolUseId = message.tool_use_id;
    const input = message.input || {};
    const actionType = this.inferActionType(toolName, input);

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'tool_use',
      content: this.formatToolInput(toolName, input),
      toolName,
      toolUseId,
      toolStatus: 'pending',
      actionType,
      metadata: {
        input,
      },
    };
  }

  private parseToolResultMessage(
    message: Extract<ClaudeMessage, { type: 'tool_result' }>,
    timestamp: string
  ): NormalizedEntry {
    const isError = message.is_error || false;
    const toolUseId = message.tool_use_id;
    const result = message.result;

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'tool_result',
      content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      toolUseId,
      toolStatus: isError ? 'failed' : 'success',
      metadata: {
        is_error: isError,
      },
    };
  }

  private parseStreamEvent(
    message: Extract<ClaudeMessage, { type: 'stream_event' }>,
    timestamp: string
  ): NormalizedEntry | null {
    const event = message.event;
    if (!event) return null;

    switch (event.type) {
      case 'message_start':
        this.streamingState = {
          messageId: uuidv4(),
          contentBlocks: new Map(),
          currentText: '',
          currentThinking: '',
        };
        return null;

      case 'content_block_start':
        if (event.content_block) {
          this.streamingState.contentBlocks.set(event.index, event.content_block);
        }
        return null;

      case 'content_block_delta':
        return this.handleContentDelta(event, timestamp);

      case 'content_block_stop':
        return null;

      case 'message_delta':
      case 'message_stop':
        return null;

      default:
        return null;
    }
  }

  private handleContentDelta(
    event: Extract<ClaudeStreamEvent, { type: 'content_block_delta' }>,
    timestamp: string
  ): NormalizedEntry | null {
    const delta = event.delta;
    if (!delta) return null;

    if (delta.type === 'text_delta' && delta.text) {
      this.streamingState.currentText += delta.text;

      // Emit streaming text update
      return {
        id: this.streamingState.messageId || uuidv4(),
        timestamp,
        entryType: 'assistant_message',
        content: this.streamingState.currentText,
        metadata: {
          streaming: true,
        },
      };
    }

    if (delta.type === 'thinking_delta' && delta.thinking) {
      this.streamingState.currentThinking += delta.thinking;

      // Emit thinking update
      return {
        id: `${this.streamingState.messageId}-thinking`,
        timestamp,
        entryType: 'thinking',
        content: this.streamingState.currentThinking,
        metadata: {
          streaming: true,
        },
      };
    }

    return null;
  }

  private parseResultMessage(
    message: Extract<ClaudeMessage, { type: 'result' }>,
    timestamp: string
  ): NormalizedEntry | null {
    if (message.is_error) {
      return {
        id: uuidv4(),
        timestamp,
        entryType: 'error_message',
        content: message.error || 'Unknown error',
        metadata: {
          duration_ms: message.duration_ms,
        },
      };
    }

    // Result message indicates completion
    return {
      id: uuidv4(),
      timestamp,
      entryType: 'system_message',
      content: `Task completed in ${message.duration_ms}ms`,
      metadata: {
        duration_ms: message.duration_ms,
        subtype: message.subtype,
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractTextContent(items: ClaudeContentItem[]): string {
    return items
      .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
      .map((item) => item.text)
      .join('\n');
  }

  private formatToolInput(toolName: string, input: Record<string, unknown>): string {
    const name = toolName.toLowerCase();

    // Format based on tool type
    if (name === 'bash' || name.includes('command')) {
      return input.command as string || JSON.stringify(input);
    }

    if (name === 'read' || name === 'glob' || name === 'grep') {
      const path = input.file_path || input.path || input.pattern;
      return `${toolName}: ${path}`;
    }

    if (name === 'edit' || name === 'write') {
      const path = input.file_path || input.path;
      return `${toolName}: ${path}`;
    }

    if (name === 'webfetch' || name === 'web_fetch') {
      return `Fetching: ${input.url}`;
    }

    if (name === 'websearch' || name === 'web_search') {
      return `Searching: ${input.query}`;
    }

    if (name === 'todowrite') {
      const todos = input.todos as Array<{ status: string; content: string; activeForm?: string }> | undefined;
      if (todos && Array.isArray(todos)) {
        const statusIcon = (status: string) => {
          switch (status) {
            case 'completed': return '✓';
            case 'in_progress': return '→';
            case 'pending': return '○';
            default: return '·';
          }
        };

        const taskLines = todos.map(t =>
          `  ${statusIcon(t.status)} ${t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content}`
        ).join('\n');

        return `TodoWrite:\n${taskLines}`;
      }
      return `${toolName}: updating tasks`;
    }

    // Default: show tool name and key input fields
    const keys = Object.keys(input).slice(0, 3);
    const summary = keys.map((k) => {
      const value = input[k];
      // Handle objects and arrays properly
      if (typeof value === 'object' && value !== null) {
        const jsonStr = JSON.stringify(value);
        return `${k}=${jsonStr.substring(0, 50)}${jsonStr.length > 50 ? '...' : ''}`;
      }
      return `${k}=${String(value).substring(0, 50)}`;
    }).join(', ');
    return `${toolName}: ${summary}`;
  }

  private inferActionType(toolName: string, input: Record<string, unknown>): ActionType {
    const name = toolName.toLowerCase();

    if (name === 'read' || name === 'glob' || name === 'grep' || name === 'ls') {
      return {
        type: 'file_read',
        path: String(input.file_path || input.path || input.pattern || ''),
      };
    }

    if (name === 'edit' || name === 'multiedit') {
      return {
        type: 'file_edit',
        path: String(input.file_path || input.path || ''),
      };
    }

    if (name === 'write') {
      return {
        type: 'file_write',
        path: String(input.file_path || input.path || ''),
      };
    }

    if (name === 'bash' || name.includes('command')) {
      return {
        type: 'command_run',
        command: String(input.command || ''),
      };
    }

    if (name === 'webfetch' || name === 'web_fetch') {
      return {
        type: 'web_fetch',
        url: String(input.url || ''),
      };
    }

    if (name === 'websearch' || name === 'web_search') {
      return {
        type: 'search',
        query: String(input.query || ''),
      };
    }

    if (name === 'task' || name === 'todowrite') {
      return {
        type: 'todo_management',
        operation: name,
      };
    }

    return {
      type: 'other',
      description: toolName,
    };
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    this.streamingState = {
      contentBlocks: new Map(),
      currentText: '',
      currentThinking: '',
    };
  }
}

export default ClaudeMessageParser;
