// ============================================================
// Direct-upload al Vercel Blob de los archivos crudos (CSV/XLSX).
// Evita el límite de 4.5 MB de las API routes: el browser sube el
// archivo directo al blob usando un token firmado que generamos acá.
// ============================================================

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pathnameFor, type OriginalKind } from '@/lib/storage/originales';

export const runtime = 'nodejs';

const ALLOWED: Record<string, OriginalKind> = {
  'originales/blip-latest.csv':   'blip',
  'originales/admin-latest.xlsx': 'admin',
};

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (session.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede subir originales.' }, { status: 403 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const kind = ALLOWED[pathname];
        if (!kind) throw new Error(`pathname no permitido: ${pathname}`);
        // El pathname debe coincidir exactamente con el canónico para que
        // sobreescriba la versión anterior (no random suffix).
        if (pathname !== pathnameFor(kind)) {
          throw new Error(`pathname inválido para kind ${kind}`);
        }
        return {
          allowedContentTypes:
            kind === 'blip'
              ? ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream']
              : [
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'application/vnd.ms-excel',
                  'application/octet-stream',
                ],
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ kind, by: session.rol }),
          maximumSizeInBytes: 60 * 1024 * 1024, // 60 MB techo defensivo
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('[upload-original] subido:', blob.pathname, tokenPayload);
      },
    });
    return NextResponse.json(json);
  } catch (err: any) {
    console.error('[upload-original] error:', err);
    return NextResponse.json({ error: err?.message ?? 'Error en upload-original' }, { status: 400 });
  }
}
