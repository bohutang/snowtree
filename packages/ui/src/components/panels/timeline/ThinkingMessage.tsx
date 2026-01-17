import { useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronRight, Circle, Square } from 'lucide-react';
import './ThinkingMessage.css';

export interface ThinkingMessageProps {
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export function ThinkingMessage({ content, timestamp, isStreaming }: ThinkingMessageProps) {
  const [expanded, setExpanded] = useState(Boolean(isStreaming));
  const [userToggled, setUserToggled] = useState(false);

  // Opencode-style UX: show thinking details while streaming; collapse once complete.
  useEffect(() => {
    if (userToggled) return;
    if (isStreaming) setExpanded(true);
    else setExpanded(false);
  }, [isStreaming, userToggled]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="thinking-message">
      <div
        className="thinking-header"
        onClick={() => {
          setUserToggled(true);
          setExpanded(!expanded);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setUserToggled(true);
            setExpanded(!expanded);
          }
        }}
      >
        {expanded ? (
          <ChevronDown className="expand-icon" size={12} />
        ) : (
          <ChevronRight className="expand-icon" size={12} />
        )}
        <Brain className="thinking-icon" title="AI is thinking" size={14} />
        <span className="thinking-label">Thinking</span>
        {isStreaming && <Circle className="streaming-indicator" title="Streaming..." size={8} />}
        <span className="thinking-timestamp">{formatTime(timestamp)}</span>
      </div>
      {expanded && (
        <div className="thinking-content">
          {content}
          {isStreaming && <Square className="cursor-blink" size={7} />}
        </div>
      )}
    </div>
  );
}
