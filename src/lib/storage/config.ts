// ============================================================
// Persistencia de la configuración de comisiones (base + tramos)
// ============================================================

import { promises as fs } from 'fs';
import path from 'path';
import { DEFAULT_CONFIG } from '@/lib/domain/types';
import type { ComisionConfig } from '@/lib/domain/types';

const KEY = 'config.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', KEY);
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function loadConfig(): Promise<ComisionConfig> {
  if (useBlob()) {
    try {
      const { list } = await import('@vercel/blob');
      const res = await list({ prefix: KEY, token: process.env.BLOB_READ_WRITE_TOKEN });
      const blob = res.blobs.find(b => b.pathname === KEY);
      if (!blob) return DEFAULT_CONFIG;
      const r = await fetch(blob.url, { cache: 'no-store' });
      if (!r.ok) return DEFAULT_CONFIG;
      return (await r.json()) as ComisionConfig;
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  try {
    return JSON.parse(await fs.readFile(LOCAL_PATH, 'utf-8')) as ComisionConfig;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(cfg: ComisionConfig): Promise<void> {
  const json = JSON.stringify(cfg, null, 2);
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    await put(KEY, json, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, json, 'utf-8');
}
