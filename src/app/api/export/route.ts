// ============================================================
// GET /api/export → genera un XLSX con todas las gestiones, tipificaciones
// y AE de los agentes. Combina:
//   - Resumen agregado del snapshot (por agente × mes)
//   - Tipificaciones por agente × mes (todas, no top-N)
//   - Detalle row-level del último CSV Blip subido (si existe)
//   - Detalle row-level del último XLSX Admin subido (si existe)
// ============================================================

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/storage/snapshot';
import { loadConfig } from '@/lib/storage/config';
import { loadOriginal } from '@/lib/storage/originales';
import { calcularComisionPorAgente, formatSol } from '@/lib/domain/comisiones';
import { AGENTES_LIST, esBlipOnly } from '@/lib/domain/agentes';
import { ordenarMeses } from '@/lib/domain/meses';
import type { MesKey } from '@/lib/domain/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const session = await getSession();
  if (session.rol !== 'admin' && session.rol !== 'jefa') {
    return NextResponse.json({ error: 'Solo admin/jefa pueden exportar.' }, { status: 403 });
  }

  const [snap, cfg, blipBuf, adminBuf] = await Promise.all([
    loadSnapshot(),
    loadConfig(),
    loadOriginal('blip'),
    loadOriginal('admin'),
  ]);

  if (!snap) {
    return NextResponse.json({ error: 'No hay datos cargados todavía.' }, { status: 404 });
  }

  const wb = XLSX.utils.book_new();

  // ============== Hoja 1: Resumen por agente × mes ==============
  const resumenRows: any[] = [];
  const meses = ordenarMeses(snap.meta.meses ?? []);
  for (const spec of AGENTES_LIST) {
    const ag = snap.agentes[spec.slug];
    if (!ag) continue;
    for (const mes of meses) {
      const m = ag.meses[mes];
      if (!m) continue;
      const isLuz = esBlipOnly(spec.slug);
      const c = calcularComisionPorAgente(
        spec.slug,
        isLuz ? 0 : m.pctSol,
        isLuz ? m.pctResolucion : m.aeTot,
        cfg,
        isLuz ? undefined : m.aten,
      );
      resumenRows.push({
        Agente: spec.nombre,
        Mes: mes,
        Atenciones: m.aten,
        Cerradas: m.cerradas,
        Transferidas: m.transferidas,
        'Deja-solicitud': m.deja,
        Solucionadas: m.solucionadas,
        'No contesta': m.noContesta,
        Solicitudes: m.sol,
        'AE cupón': m.aeCup,
        'AE preowner': m.aePre,
        'AE total': m.aeTot,
        '% Sol/Cerradas': m.pctSol,
        '% Resolución (Luz)': m.pctResolucion,
        '% Deja/Cerradas': m.pctDeja,
        'Base S/': c.baseSol,
        'Tramo P1': c.pilar1.tramo.label,
        'P1 aplicado': c.pilar1.aplicado,
        'Capada por guardrail': c.pilar1.capadoPorGuardrail ? 'Sí' : '',
        'Tramo P2': c.pilar2.tramo.label,
        'P2 aplicado': c.pilar2.aplicado,
        'Comisión total S/': c.total,
        'Comisión formateada': formatSol(c.total),
      });
    }
  }
  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // ============== Hoja 2: Tipificaciones por agente × mes ==============
  const tipRows: any[] = [];
  for (const spec of AGENTES_LIST) {
    const ag = snap.agentes[spec.slug];
    if (!ag) continue;
    for (const mes of meses) {
      const m = ag.meses[mes];
      if (!m) continue;
      for (const { tag, n } of m.tags) {
        tipRows.push({ Agente: spec.nombre, Mes: mes, Tipificación: tag, Conteo: n });
      }
    }
  }
  const wsTip = XLSX.utils.json_to_sheet(tipRows);
  XLSX.utils.book_append_sheet(wb, wsTip, 'Tipificaciones');

  // ============== Hoja 3: AE diaria por agente × mes × día ==============
  const aeDiaRows: any[] = [];
  for (const spec of AGENTES_LIST) {
    const ag = snap.agentes[spec.slug];
    if (!ag) continue;
    for (const mes of meses) {
      const dias = ag.diario[mes];
      if (!dias) continue;
      for (const d of dias) {
        if (d.ae === 0 && d.aten === 0 && d.cerradas === 0) continue;
        aeDiaRows.push({
          Agente: spec.nombre, Mes: mes, Día: d.day,
          Atenciones: d.aten, Cerradas: d.cerradas,
          Deja: d.deja, Solucionadas: d.solucionadas, AE: d.ae,
        });
      }
    }
  }
  const wsDia = XLSX.utils.json_to_sheet(aeDiaRows);
  XLSX.utils.book_append_sheet(wb, wsDia, 'Diario');

  // ============== Hoja 4: Detalle Blip (último CSV subido) ==============
  if (blipBuf) {
    try {
      const txt = stripBom(blipBuf.toString('utf-8'));
      const wbBlip = XLSX.read(txt, { type: 'string', FS: ';', raw: true });
      const wsBlipOrig = wbBlip.Sheets[wbBlip.SheetNames[0]];
      if (wsBlipOrig) {
        XLSX.utils.book_append_sheet(wb, wsBlipOrig, 'Detalle Blip');
      }
    } catch (err) {
      console.error('[export] no pude leer Blip CSV:', err);
    }
  }

  // ============== Hoja 5: Detalle Admin (último XLSX subido) ==============
  if (adminBuf) {
    try {
      const wbAdmin = XLSX.read(adminBuf, { type: 'buffer', cellDates: true });
      const wsAdminOrig = wbAdmin.Sheets[wbAdmin.SheetNames[0]];
      if (wsAdminOrig) {
        XLSX.utils.book_append_sheet(wb, wsAdminOrig, 'Detalle Admin');
      }
    } catch (err) {
      console.error('[export] no pude leer Admin XLSX:', err);
    }
  }

  // Serializar a buffer y devolver
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const fecha = new Date().toISOString().slice(0, 10);
  const filename = `baldecash-sae-${fecha}.xlsx`;
  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}
