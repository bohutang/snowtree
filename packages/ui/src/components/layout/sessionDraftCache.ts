import type { ImageAttachment } from './types';
import type { JSONContent } from '@tiptap/core';

export type SessionDraft = {
  html?: string; // Legacy format
  json?: JSONContent; // New Tiptap format
  images: ImageAttachment[];
  updatedAt: number;
};

const MAX_DRAFTS = 50;
const draftsBySessionId = new Map<string, SessionDraft>();

function pruneIfNeeded(): void {
  if (draftsBySessionId.size <= MAX_DRAFTS) return;
  const entries = Array.from(draftsBySessionId.entries());
  entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const toRemove = entries.slice(0, Math.max(0, entries.length - MAX_DRAFTS));
  for (const [sessionId] of toRemove) draftsBySessionId.delete(sessionId);
}

export function getSessionDraft(sessionId: string): SessionDraft | null {
  return draftsBySessionId.get(sessionId) ?? null;
}

export function setSessionDraft(sessionId: string, draft: Omit<SessionDraft, 'updatedAt'>): void {
  const html = draft.html ? String(draft.html) : undefined;
  const json = draft.json || undefined;
  const images = Array.isArray(draft.images) ? draft.images : [];

  // If both html/json are empty and no images, delete draft
  const hasContent = (html && html.trim().length > 0) ||
                     (json && json.content && json.content.length > 0) ||
                     images.length > 0;

  if (!hasContent) {
    draftsBySessionId.delete(sessionId);
    return;
  }

  draftsBySessionId.set(sessionId, { html, json, images, updatedAt: Date.now() });
  pruneIfNeeded();
}

export function clearSessionDraft(sessionId: string): void {
  draftsBySessionId.delete(sessionId);
}

