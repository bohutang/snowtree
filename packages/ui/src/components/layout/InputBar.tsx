import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown, Sparkles, Code2, Loader2 } from 'lucide-react';
import type { InputBarProps, CLITool, ImageAttachment } from './types';
import { API } from '../../utils/api';
import { withTimeout } from '../../utils/withTimeout';
import type { TimelineEvent } from '../../types/timeline';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const BlockCursor: React.FC<{ 
  editorRef: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  color: string;
}> = ({ editorRef, visible, color }) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!visible || !editorRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        setPosition(null);
        return;
      }

      const editor = editorRef.current;
      if (!editor || !editor.contains(range.startContainer)) {
        setPosition(null);
        return;
      }

      const rects = range.getClientRects();
      const editorRect = editor.getBoundingClientRect();
      
      if (rects.length > 0) {
        const rect = rects[0];
        setPosition({
          top: rect.top - editorRect.top,
          left: rect.left - editorRect.left,
        });
      } else {
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setPosition({ top: 0, left: 0 });
        } else {
          setPosition({
            top: rect.top - editorRect.top,
            left: rect.left - editorRect.left,
          });
        }
      }
    };

    updatePosition();

    const editor = editorRef.current;
    const observer = new MutationObserver(updatePosition);
    observer.observe(editor, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });

    document.addEventListener('selectionchange', updatePosition);
    
    return () => {
      observer.disconnect();
      document.removeEventListener('selectionchange', updatePosition);
    };
  }, [visible, editorRef]);

  if (!visible || !position) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: position.top,
        left: position.left,
        width: '8px',
        height: '19px',
        backgroundColor: color,
        opacity: 0.7,
      }}
    />
  );
};

const KnightRiderSpinner: React.FC<{ color?: string }> = ({ color = 'var(--st-accent)' }) => {
  const [frame, setFrame] = useState(0);
  const width = 8;
  const trailLength = 3;
  const totalFrames = width * 2 - 2;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % totalFrames);
    }, 60);
    return () => clearInterval(interval);
  }, [totalFrames]);

  const activePos = frame < width ? frame : (width * 2 - 2 - frame);

  return (
    <div className="flex gap-[1px] items-center">
      {Array.from({ length: width }).map((_, i) => {
        const distance = Math.abs(i - activePos);
        const isActive = distance < trailLength;
        const opacity = isActive ? 1 - (distance / trailLength) * 0.6 : 0.2;
        return (
          <div
            key={i}
            className="w-[5px] h-[5px] rounded-[1px]"
            style={{
              backgroundColor: color,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};

type ToolAvailability = {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
};

type AiToolsStatus = {
  fetchedAt?: string;
  cached?: boolean;
  claude: ToolAvailability;
  codex: ToolAvailability;
};

type ToolDisplaySettings = {
  model?: string;
  level?: string;
};

type AiToolSettingsResponse = {
  claude?: { model?: string };
  codex?: { model?: string; reasoningEffort?: string; sandbox?: string; askForApproval?: string };
};

const formatCliVersion = (version?: string): string | undefined => {
  if (!version) return undefined;
  const trimmed = version.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/(\d+\.\d+\.\d+)/);
  return match ? `v${match[1]}` : trimmed;
};

const CLISelector: React.FC<{
  selected: CLITool;
  onChange: (tool: CLITool) => void;
  disabled: boolean;
  availability: AiToolsStatus | null;
  availabilityLoading: boolean;
  settingsLoading: boolean;
  settings: Record<CLITool, ToolDisplaySettings>;
  onOpen: () => void;
}> = React.memo(({ selected, onChange, disabled, availability, availabilityLoading, settingsLoading, settings, onOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tools: { id: CLITool; label: string; icon: React.ReactNode }[] = [
    { id: 'claude', label: 'Claude', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'codex', label: 'Codex', icon: <Code2 className="w-3.5 h-3.5" /> },
  ];

  const selectedTool = tools.find(t => t.id === selected) || tools[0];
  const availabilityForSelected = availability?.[selected];
  const isSelectedAvailable = availabilityLoading ? true : (availabilityForSelected?.available ?? true);
  const isProbing = availabilityLoading || settingsLoading;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => {
          if (disabled) return;
          const next = !isOpen;
          setIsOpen(next);
          if (next) onOpen();
        }}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all st-focus-ring ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer st-hoverable'
        } ${isOpen ? 'st-selected' : ''}`}
        title={!isSelectedAvailable ? (availabilityForSelected?.error || `${selectedTool.label} unavailable`) : undefined}
      >
        {selectedTool.icon}
        <span style={{ color: 'var(--st-text)' }}>{selectedTool.label}</span>
        {isProbing && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--st-text-faint)' }} />}
        {!availabilityLoading && !isSelectedAvailable && <span className="text-[10px] uppercase tracking-wider st-text-faint">Unavailable</span>}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--st-text-faint)' }} />
      </button>

      <div
        className={`absolute bottom-full left-0 mb-1 border rounded-lg shadow-xl py-1 min-w-[280px] z-50 transition-all origin-bottom relative ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-1 pointer-events-none'
        }`}
        style={{ transitionDuration: '150ms' }}
      >
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            backgroundColor: 'var(--st-surface)',
            border: '1px solid color-mix(in srgb, var(--st-border) 70%, transparent)',
          }}
        />
        {tools.map((tool) => {
          const toolSettings = settings[tool.id];
          const toolAvailability = availability?.[tool.id];
          const subtitle = [
            toolSettings?.model,
            tool.id === 'codex' ? toolSettings?.level : null,
            formatCliVersion(toolAvailability?.version)
          ].filter(Boolean).join(' · ');
          
          return (
            <button
              key={tool.id}
              onClick={() => {
                if (!availabilityLoading && toolAvailability && !toolAvailability.available) {
                  return;
                }
                onChange(tool.id);
                setIsOpen(false);
              }}
              disabled={!availabilityLoading && !!toolAvailability && !toolAvailability.available}
              className={`relative w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors st-focus-ring ${
                selected === tool.id ? 'st-selected' : 'st-hoverable'
              } ${!availabilityLoading && toolAvailability && !toolAvailability.available ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tool.icon}
              <div className="flex flex-col items-start min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--st-text)' }}>{tool.label}</span>
                  {!availabilityLoading && toolAvailability?.available === false && (
                    <span className="text-[10px] uppercase tracking-wider st-text-faint">Unavailable</span>
                  )}
                </div>
                {subtitle && (
                  <span className="text-[11px] truncate max-w-[260px] st-text-faint">{subtitle}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

CLISelector.displayName = 'CLISelector';

export const InputBar: React.FC<InputBarProps> = React.memo(({
  session,
  panelId: _panelId,
  selectedTool,
  onToolChange,
  onSend,
  onCancel,
  isProcessing,
  placeholder = 'Message...',
  focusRequestId
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const [aiToolsStatus, setAiToolsStatus] = useState<AiToolsStatus | null>(null);
  const [, setAiToolsLoading] = useState(false);
  const [, setToolSettingsProbeLoading] = useState(true);
  const [, setToolSettingsTimelineLoading] = useState(true);
  const [toolSettings, setToolSettings] = useState<Record<CLITool, ToolDisplaySettings>>({
    claude: {},
    codex: {}
  });
  const [escPending, setEscPending] = useState(false);
  const escTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageIdCounter = useRef(0);

  const getEditorText = useCallback(() => {
    if (!editorRef.current) return '';
    return editorRef.current.innerText || '';
  }, []);

  const checkEmpty = useCallback(() => {
    const text = getEditorText().trim();
    const hasPills = editorRef.current?.querySelector('[data-image-id]') !== null;
    setIsEmpty(!text && !hasPills);
  }, [getEditorText]);

  const insertImageTag = useCallback((index: number, id: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const pill = document.createElement('span');
    pill.textContent = `[Image ${index}]`;
    pill.setAttribute('data-image-id', id);
    pill.setAttribute('contenteditable', 'false');
    pill.style.cssText = `
      display: inline-block;
      padding: 2px 6px;
      margin: 0 2px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
      background-color: color-mix(in srgb, var(--st-accent) 15%, transparent);
      border: 1px solid var(--st-accent);
      color: var(--st-accent);
      user-select: all;
      cursor: default;
    `;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(pill);
      range.setStartAfter(pill);
      range.setEndAfter(pill);
      
      const space = document.createTextNode(' ');
      range.insertNode(space);
      range.setStartAfter(space);
      range.setEndAfter(space);
      
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.appendChild(pill);
      editor.appendChild(document.createTextNode(' '));
    }
    
    editor.focus();
  }, []);

  const addImageAttachment = useCallback((file: File): Promise<void> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const id = `img-${Date.now()}-${imageIdCounter.current++}`;
        const imageIndex = imageAttachments.length + 1;
        
        setImageAttachments((prev) => [...prev, {
          id,
          filename: file.name || 'image.png',
          mime: file.type || 'image/png',
          dataUrl,
        }]);
        
        insertImageTag(imageIndex, id);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }, [imageAttachments.length, insertImageTag]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const observer = new MutationObserver(() => {
      const currentPills = editor.querySelectorAll('[data-image-id]');
      const currentIds = new Set(Array.from(currentPills).map(p => p.getAttribute('data-image-id')));
      
      setImageAttachments((prev) => prev.filter((img) => currentIds.has(img.id)));
      checkEmpty();
    });

    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [checkEmpty]);

  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = Array.from(clipboardData.items);
      const imageItems = items.filter((item) => ACCEPTED_IMAGE_TYPES.includes(item.type));

      if (imageItems.length > 0) {
        e.preventDefault();
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file) await addImageAttachment(file);
        }
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [addImageAttachment]);

  const handleSubmit = useCallback(() => {
    const text = getEditorText().trim();
    if (!text && imageAttachments.length === 0) return;
    if (isProcessing) return;

    onSend(text, imageAttachments.length > 0 ? imageAttachments : undefined);
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setImageAttachments([]);
    setIsEmpty(true);
  }, [getEditorText, imageAttachments, isProcessing, onSend]);

  const isRunning = session.status === 'running' || session.status === 'initializing';

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isRunning) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isRunning]);

  useEffect(() => {
    if (!isRunning) {
      setEscPending(false);
      if (escTimeoutRef.current) {
        clearTimeout(escTimeoutRef.current);
        escTimeoutRef.current = null;
      }
    }
  }, [isRunning]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('esc-pending-change', { detail: { escPending } }));
  }, [escPending]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRunning) {
        e.preventDefault();
        if (escPending) {
          if (escTimeoutRef.current) {
            clearTimeout(escTimeoutRef.current);
            escTimeoutRef.current = null;
          }
          setEscPending(false);
          onCancel();
        } else {
          setEscPending(true);
          escTimeoutRef.current = setTimeout(() => {
            setEscPending(false);
            escTimeoutRef.current = null;
          }, 5000);
        }
      }
    };
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const tools: CLITool[] = ['claude', 'codex'];
      const currentIndex = tools.indexOf(selectedTool);
      const nextIndex = (currentIndex + 1) % tools.length;
      onToolChange(tools[nextIndex]);
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('keydown', handleTabKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('keydown', handleTabKey, { capture: true });
    };
  }, [isRunning, escPending, onCancel, selectedTool, onToolChange]);

  useEffect(() => {
    if (!focusRequestId) return;
    editorRef.current?.focus();
  }, [focusRequestId]);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  const loadAvailability = useCallback(async (force?: boolean) => {
    setAiToolsLoading(true);
    try {
      const res = await API.aiTools.getStatus({ force });
      if (res.success && res.data) {
        setAiToolsStatus(res.data as AiToolsStatus);
      }
    } finally {
      setAiToolsLoading(false);
    }
  }, []);

  const applyTimelineEventToSettings = useCallback((event: TimelineEvent) => {
    if (event.kind !== 'cli.command') return;
    if (event.tool !== 'claude' && event.tool !== 'codex') return;
    const meta = (event.meta || {}) as Record<string, unknown>;
    const cliModel = typeof meta.cliModel === 'string' ? meta.cliModel : undefined;
    const cliReasoningEffort = typeof meta.cliReasoningEffort === 'string' ? meta.cliReasoningEffort : undefined;

    setToolSettings((prev) => {
      const next = { ...prev };
      if (event.tool === 'claude') {
        next.claude = {
          ...next.claude,
          model: cliModel ?? next.claude.model,
        };
      } else {
        next.codex = {
          ...next.codex,
          model: cliModel ?? next.codex.model,
          level: cliReasoningEffort ?? next.codex.level,
        };
      }
      return next;
    });
  }, []);

  const loadToolSettingsFromProbe = useCallback(async () => {
    setToolSettingsProbeLoading(true);
    try {
      const res = await withTimeout(API.aiTools.getSettings(), 8_000, 'Detect CLI settings');
      if (!res.success || !res.data) return;
      const data = res.data as AiToolSettingsResponse;
      setToolSettings((prev) => ({
        claude: {
          model: typeof data.claude?.model === 'string' ? data.claude?.model : prev.claude.model,
        },
        codex: {
          model: typeof data.codex?.model === 'string' ? data.codex?.model : prev.codex.model,
          level: typeof data.codex?.reasoningEffort === 'string' ? data.codex?.reasoningEffort : prev.codex.level,
        },
      }));
    } catch {
    } finally {
      setToolSettingsProbeLoading(false);
    }
  }, []);

  const loadToolSettingsFromTimeline = useCallback(async () => {
    setToolSettingsTimelineLoading(true);
    try {
      const res = await withTimeout(API.sessions.getTimeline(session.id), 8_000, 'Load runtime settings');
      if (!res.success || !Array.isArray(res.data)) return;
      const events = res.data as TimelineEvent[];

      let lastClaude: TimelineEvent | null = null;
      let lastCodex: TimelineEvent | null = null;
      for (const e of events) {
        if (e.kind !== 'cli.command') continue;
        if (e.tool === 'claude') lastClaude = e;
        if (e.tool === 'codex') lastCodex = e;
      }
      if (lastClaude) applyTimelineEventToSettings(lastClaude);
      if (lastCodex) applyTimelineEventToSettings(lastCodex);
    } catch {
    } finally {
      setToolSettingsTimelineLoading(false);
    }
  }, [session.id, applyTimelineEventToSettings]);

  useEffect(() => {
    void loadToolSettingsFromProbe();
    loadToolSettingsFromTimeline();
  }, [loadToolSettingsFromProbe, loadToolSettingsFromTimeline]);

  useEffect(() => {
    if (!window.electronAPI?.events?.onTimelineEvent) return;
    const unsubscribe = window.electronAPI.events.onTimelineEvent((data) => {
      if (data.sessionId !== session.id) return;
      const event = data.event as TimelineEvent | undefined;
      if (!event) return;
      applyTimelineEventToSettings(event);
    });
    return () => unsubscribe();
  }, [session.id, applyTimelineEventToSettings]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const agentName = selectedTool === 'claude' ? 'Claude' : 'Codex';
  const selectedSettings = toolSettings[selectedTool];
  const availabilityForSelected = aiToolsStatus?.[selectedTool];
  const modelInfo = selectedSettings.model || '';
  const levelInfo = selectedTool === 'codex' && selectedSettings.level ? selectedSettings.level : '';
  const versionInfo = formatCliVersion(availabilityForSelected?.version) || '';

  return (
    <div className="flex-shrink-0 px-4 py-2" style={{ backgroundColor: 'var(--st-bg)' }}>
      <div className="flex">
        <div
          className="w-[2px] self-stretch transition-colors duration-150"
          style={{ backgroundColor: isFocused || isRunning ? 'var(--st-accent)' : 'var(--st-border-variant)' }}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="ml-2">
            <div
              className="px-3 py-2"
              style={{ backgroundColor: 'var(--st-editor)' }}
            >
              <div className="relative">
                <div
                  ref={editorRef}
                  contentEditable
                  onKeyDown={handleKeyDown}
                  onInput={checkEmpty}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="w-full bg-transparent text-[13px] focus:outline-none min-h-[20px] max-h-[144px] overflow-y-auto"
                  style={{
                    color: isRunning ? 'var(--st-text-faint)' : 'var(--st-text)',
                    caretColor: 'transparent',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                />
                <BlockCursor 
                  editorRef={editorRef} 
                  visible={isFocused && !isRunning} 
                  color="var(--st-text)"
                />
                {isEmpty && !isRunning && (
                  <div
                    className="absolute top-0 left-0 text-[13px] pointer-events-none"
                    style={{ color: 'var(--st-text-faint)', opacity: 0.6 }}
                  >
                    {placeholder}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2 text-[12px]">
                <span style={{ color: 'var(--st-accent)' }}>{agentName}</span>
                {modelInfo && (
                  <span style={{ color: 'var(--st-text)' }}>{modelInfo}</span>
                )}
                {levelInfo && (
                  <span style={{ color: 'var(--st-text-faint)' }}>{levelInfo}</span>
                )}
                {versionInfo && (
                  <span style={{ color: 'var(--st-text-faint)' }}>{versionInfo}</span>
                )}
              </div>
            </div>
            <div 
              className="h-[3px]"
              style={{ 
                background: `linear-gradient(to bottom, var(--st-editor) 0%, transparent 100%)` 
              }}
            />
          </div>

          <div className="flex items-center justify-between ml-2 mt-1 text-[11px]">
            <div className="flex items-center gap-2">
              {isRunning && (
                <>
                  <KnightRiderSpinner color="var(--st-accent)" />
                  <span style={{ color: escPending ? 'var(--st-accent)' : 'var(--st-text)' }}>
                    esc{' '}
                    <span style={{ color: escPending ? 'var(--st-accent)' : 'var(--st-text-faint)' }}>
                      {escPending ? 'again to interrupt' : 'interrupt'}
                    </span>
                  </span>
                </>
              )}
            </div>
            <span style={{ color: 'var(--st-text)' }}>
              tab{' '}
              <span style={{ color: 'var(--st-text-faint)' }}>switch agent</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

InputBar.displayName = 'InputBar';

export default InputBar;
