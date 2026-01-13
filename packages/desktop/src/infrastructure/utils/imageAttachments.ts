import * as fs from 'fs';
import * as path from 'path';

import { getSnowtreeSubdirectory } from './snowtreeDirectory';

export type RendererImageAttachment = {
  id: string;
  filename: string;
  mime: string;
  dataUrl: string;
};

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/tiff': 'tiff',
};

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  if (typeof dataUrl !== 'string') return null;
  // Typical FileReader DataURL: data:<mime>;base64,<payload>
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  try {
    const bytes = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
    return { mime, bytes };
  } catch {
    return null;
  }
}

function safeBasename(filename: string): string {
  const base = path.basename(String(filename || 'image'));
  const trimmed = base.trim();
  if (!trimmed) return 'image';
  // Prevent pathological names; keep it simple.
  return trimmed.replace(/[^\w.\-()+\s]/g, '_');
}

function extFromMime(mime: string, fallbackFilename: string): string {
  const byMime = EXT_BY_MIME[String(mime || '').toLowerCase()];
  if (byMime) return byMime;
  const ext = path.extname(fallbackFilename || '').replace(/^\./, '').toLowerCase();
  return ext || 'png';
}

export function persistRendererImageAttachments(
  sessionId: string,
  images: RendererImageAttachment[]
): { dir: string; imagePaths: string[] } {
  const normalized = Array.isArray(images) ? images : [];
  const safeSessionId = String(sessionId || '').trim() || 'unknown-session';
  const dir = getSnowtreeSubdirectory('sessions', safeSessionId, 'attachments');

  fs.mkdirSync(dir, { recursive: true });

  const imagePaths: string[] = [];
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');

  for (let i = 0; i < normalized.length; i++) {
    const img = normalized[i];
    if (!img || typeof img.dataUrl !== 'string') continue;
    const decoded = decodeDataUrl(img.dataUrl);
    if (!decoded) continue;

    const base = safeBasename(img.filename || `image-${i + 1}`);
    const ext = extFromMime(img.mime || decoded.mime, base);
    const idPart = typeof img.id === 'string' && img.id.trim() ? img.id.trim().replace(/[^\w.\-]/g, '_') : `img${i + 1}`;
    const outName = `${stamp}-${idPart}.${ext}`;
    const outPath = path.join(dir, outName);

    fs.writeFileSync(outPath, decoded.bytes);
    imagePaths.push(outPath);
  }

  return { dir, imagePaths };
}
