// ============================================================
// Persistencia del snapshot procesado
// ============================================================
// En producción (Vercel) usa @vercel/blob.
// En desarrollo local, si no hay BLOB_READ_WRITE_TOKEN, cae a un archivo
// data/snapshot.json del propio repo.

import { promises as fs } from 'fs';
import path from 'path';
import type { DataSnapshot } from '@/lib/domain/types';

const SNAPSHOT_KEY = 'snapshot.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', SNAPSHOT_KEY);

const useBlob = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function loadSnapshot(): Promise<DataSnapshot | null> {
  if (useBlob()) {
    try {
      const { list } = await import('@vercel/blob');
      const res = await list({ prefix: SNAPSHOT_KEY, token: process.env.BLOB_READ_WRITE_TOKEN });
      const blob = res.blobs.find(b => b.pathname === SNAPSHOT_KEY);
      if (!blob) return null;
      const r = await fetch(blob.url, { cache: 'no-store' });
      if (!r.ok) return null;
      return (await r.json()) as DataSnapshot;
    } catch (err) {
      console.error('[snapshot] error leyendo Blob:', err);
      return null;
    }
  }
  try {
    const txt = await fs.readFile(LOCAL_PATH, 'utf-8');
    return JSON.parse(txt) as DataSnapshot;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveSnapshot(snap: DataSnapshot): Promise<{ url?: string }> {
  const json = JSON.stringify(snap);
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    const res = await put(SNAPSHOT_KEY, json, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: res.url };
  }
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, json, 'utf-8');
  return { url: LOCAL_PATH };
}
