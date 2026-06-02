// ============================================================
// Persistencia de los archivos crudos subidos por admin (Blip CSV +
// Admin XLSX). Se guarda solo la última carga (latest); cada upload
// sobrescribe la anterior. Se usa para generar la hoja "Detalle" del
// Excel descargable sin tener que volver a parsear desde el browser.
// ============================================================

import { promises as fs } from 'fs';
import path from 'path';

export type OriginalKind = 'blip' | 'admin';

const KEYS: Record<OriginalKind, string> = {
  blip:  'originales/blip-latest.csv',
  admin: 'originales/admin-latest.xlsx',
};

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function localPath(kind: OriginalKind): string {
  return path.join(process.cwd(), 'data', KEYS[kind]);
}

/**
 * Lee el archivo original más reciente del blob (o filesystem local).
 * Devuelve null si nunca se subió.
 */
export async function loadOriginal(kind: OriginalKind): Promise<Buffer | null> {
  if (useBlob()) {
    try {
      const { list } = await import('@vercel/blob');
      const res = await list({ prefix: KEYS[kind], token: process.env.BLOB_READ_WRITE_TOKEN });
      const blob = res.blobs.find(b => b.pathname === KEYS[kind]);
      if (!blob) return null;
      const r = await fetch(blob.url, { cache: 'no-store' });
      if (!r.ok) return null;
      const ab = await r.arrayBuffer();
      return Buffer.from(ab);
    } catch (err) {
      console.error('[originales] error leyendo blob:', err);
      return null;
    }
  }
  try {
    return await fs.readFile(localPath(kind));
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Guarda el archivo original (sobrescribiendo el anterior). En producción
 * normalmente se usa el direct-upload del browser vía @vercel/blob/client
 * y este helper solo se usa en dev local.
 */
export async function saveOriginal(kind: OriginalKind, body: Buffer): Promise<void> {
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    await put(KEYS[kind], body, {
      access: 'public',
      addRandomSuffix: false,
      contentType: kind === 'blip'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return;
  }
  const p = localPath(kind);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

/** Pathname canónico para una clase de original (útil para el cliente direct-upload). */
export function pathnameFor(kind: OriginalKind): string {
  return KEYS[kind];
}
