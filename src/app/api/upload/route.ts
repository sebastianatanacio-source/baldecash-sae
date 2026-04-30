import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildSnapshot } from '@/lib/parser';
import { saveSnapshot } from '@/lib/storage/snapshot';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (session.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo el rol admin puede cargar archivos.' }, { status: 403 });
  }

  const form = await req.formData();
  const csv = form.get('blip');
  const xlsx = form.get('admin');
  if (!(csv instanceof File) || !(xlsx instanceof File)) {
    return NextResponse.json({ error: 'Adjunta ambos archivos: CSV de Blip y XLSX de Admin.' }, { status: 400 });
  }

  try {
    const csvBuf  = Buffer.from(await csv.arrayBuffer());
    const xlsxBuf = Buffer.from(await xlsx.arrayBuffer());

    const t0 = Date.now();
    const report = await buildSnapshot({
      csvBuffer: csvBuf,
      xlsxBuffer: xlsxBuf,
      archivoBlip: csv.name,
      archivoAdmin: xlsx.name,
      generadoPor: session.display ?? session.rol,
    });
    const ms = Date.now() - t0;

    await saveSnapshot(report.snapshot);

    return NextResponse.json({
      ok: true,
      tomaMs: ms,
      meta: report.snapshot.meta,
      blip: report.blip,
      admin: report.admin,
      warnings: report.warnings,
    });
  } catch (err: any) {
    console.error('[upload] error procesando archivos:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Error al procesar los archivos.' },
      { status: 500 },
    );
  }
}
