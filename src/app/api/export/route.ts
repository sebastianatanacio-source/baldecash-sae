// ============================================================
// GET /api/export[?mes=may] → genera un XLSX. Si se pasa `mes`, todas las
// hojas se filtran a ese mes y se agregan dos hojas adicionales:
//   - "Comisión <mes>": resumen vertical de la comisión por asesora
//   - "Solicitudes <mes>": detalle row-level del XLSX Admin con la
//     atribución (asesora + vía cupón/preowner) ya resuelta.
// ============================================================

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/storage/snapshot';
import { loadConfig } from '@/lib/storage/config';
import { loadOriginal } from '@/lib/storage/originales';
import { calcularComisionPorAgente, formatSol } from '@/lib/domain/comisiones';
import { AGENTES_LIST, esBlipOnly, detectarAgenteAdmin } from '@/lib/domain/agentes';
import { MES_MAP, MES_LABEL, MES_ORDEN, ordenarMeses } from '@/lib/domain/meses';
import { cfgPorMes } from '@/lib/domain/esquemas-historicos';
import type { MesKey } from '@/lib/domain/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// MM (numérico) por MesKey, derivado de MES_MAP para no duplicar la verdad.
const MES_NUM: Partial<Record<MesKey, string>> = (() => {
  const out: Partial<Record<MesKey, string>> = {};
  for (const [iso, key] of Object.entries(MES_MAP)) {
    const mm = iso.split('-')[1];
    out[key] = mm;
  }
  return out;
})();

export async function GET(req: Request) {
  const session = await getSession();
  if (session.rol !== 'admin' && session.rol !== 'jefa') {
    return NextResponse.json({ error: 'Solo admin/jefa pueden exportar.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const mesParam = url.searchParams.get('mes');
  const mesFiltro: MesKey | null =
    mesParam && (MES_ORDEN as readonly string[]).includes(mesParam) ? (mesParam as MesKey) : null;

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
  const allMeses = ordenarMeses(snap.meta.meses ?? []);
  const meses = mesFiltro ? allMeses.filter(m => m === mesFiltro) : allMeses;

  // ============== Hoja 1: Resumen por agente × mes ==============
  const resumenRows: any[] = [];
  for (const spec of AGENTES_LIST) {
    const ag = snap.agentes[spec.slug];
    if (!ag) continue;
    for (const mes of meses) {
      const m = ag.meses[mes];
      if (!m) continue;
      const isLuz = esBlipOnly(spec.slug);
      const cfgMes = cfgPorMes(cfg, mes);
      const c = calcularComisionPorAgente(
        spec.slug,
        isLuz ? 0 : m.pctSol,
        isLuz ? m.pctResolucion : m.aeTot,
        cfgMes,
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), 'Resumen');

  // ============== Hoja 2: Comisión <mes> — solo si hay mes elegido ==============
  if (mesFiltro) {
    const comRows: any[] = [];
    for (const spec of AGENTES_LIST) {
      const ag = snap.agentes[spec.slug];
      const m = ag?.meses[mesFiltro];
      if (!ag || !m) continue;
      const isLuz = esBlipOnly(spec.slug);
      const cfgMes = cfgPorMes(cfg, mesFiltro);
      const c = calcularComisionPorAgente(
        spec.slug,
        isLuz ? 0 : m.pctSol,
        isLuz ? m.pctResolucion : m.aeTot,
        cfgMes,
        isLuz ? undefined : m.aten,
      );
      // Vista vertical (un bloque por asesora) — cada métrica en su fila
      comRows.push({ Asesora: spec.nombre, Métrica: 'Atenciones',           Valor: m.aten });
      comRows.push({ Asesora: spec.nombre, Métrica: 'Cerradas',             Valor: m.cerradas });
      comRows.push({ Asesora: spec.nombre, Métrica: 'Transferidas',         Valor: m.transferidas });
      if (isLuz) {
        comRows.push({ Asesora: spec.nombre, Métrica: 'Solucionadas',       Valor: m.solucionadas });
        comRows.push({ Asesora: spec.nombre, Métrica: 'No contesta',        Valor: m.noContesta });
        comRows.push({ Asesora: spec.nombre, Métrica: '% Resolución',       Valor: m.pctResolucion });
        comRows.push({ Asesora: spec.nombre, Métrica: 'Umbral mínimo',      Valor: c.pilar2.tramo.min });
      } else {
        comRows.push({ Asesora: spec.nombre, Métrica: 'Solicitudes',        Valor: m.sol });
        comRows.push({ Asesora: spec.nombre, Métrica: 'AE cupón',           Valor: m.aeCup });
        comRows.push({ Asesora: spec.nombre, Métrica: 'AE preowner',        Valor: m.aePre });
        comRows.push({ Asesora: spec.nombre, Métrica: 'AE total',           Valor: m.aeTot });
        comRows.push({ Asesora: spec.nombre, Métrica: '% Sol/Cerradas',     Valor: m.pctSol });
        comRows.push({ Asesora: spec.nombre, Métrica: 'Base S/',            Valor: c.baseSol });
        comRows.push({ Asesora: spec.nombre, Métrica: 'Tramo Pilar 1',      Valor: c.pilar1.tramo.label });
        comRows.push({ Asesora: spec.nombre, Métrica: 'P1 aplicado S/',     Valor: c.pilar1.aplicado });
        if (c.pilar1.capadoPorGuardrail) {
          comRows.push({ Asesora: spec.nombre, Métrica: 'Capada por guardrail', Valor: 'Sí' });
        }
        comRows.push({ Asesora: spec.nombre, Métrica: 'Tramo Pilar 2',      Valor: c.pilar2.tramo.label });
        comRows.push({ Asesora: spec.nombre, Métrica: 'P2 aplicado S/',     Valor: c.pilar2.aplicado });
      }
      comRows.push({ Asesora: spec.nombre, Métrica: 'Comisión total S/',    Valor: c.total });
      comRows.push({ Asesora: spec.nombre, Métrica: 'Comisión formateada',  Valor: formatSol(c.total) });
      comRows.push({ Asesora: '', Métrica: '', Valor: '' }); // separador
    }
    const tab = `Comisión ${MES_LABEL[mesFiltro].slice(0, 3)}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comRows), tab);
  }

  // ============== Hoja 3: Tipificaciones ==============
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tipRows), 'Tipificaciones');

  // ============== Hoja 4: Diario ==============
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aeDiaRows), 'Diario');

  // ============== Hoja 5: Solicitudes <mes> — row-level Admin con atribución ==============
  // Si hay un mes elegido, parseamos el XLSX Admin, filtramos por Fecha de
  // creación del mes, resolvemos la atribución (cupón → preowner) y emitimos
  // un detalle granular para auditar.
  if (mesFiltro && adminBuf) {
    try {
      const mm = MES_NUM[mesFiltro];
      const wbAdmin = XLSX.read(adminBuf, { type: 'buffer', cellDates: true });
      const wsAdmin = wbAdmin.Sheets[wbAdmin.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wsAdmin, { defval: null, raw: true });
      const detRows: any[] = [];
      for (const r of rows) {
        const fecha = parseDateMaybe(r['Fecha']);
        if (!fecha) continue;
        const mmFecha = String(fecha.getMonth() + 1).padStart(2, '0');
        const yyyyFecha = String(fecha.getFullYear());
        if (mmFecha !== mm || yyyyFecha !== '2026') continue;

        const cupon = String(r['Cupón'] ?? '').trim();
        const preowner = String(r['Preowner'] ?? '').trim();
        const estado = String(r['Estado'] ?? '').trim();
        const airt = String(r['EstadoSolicitudAirtable'] ?? '').trim();
        const det = detectarAgenteAdmin(cupon, preowner);
        if (!det) continue;
        const spec = AGENTES_LIST.find(a => a.slug === det.slug)!;
        const fFirma = parseDateMaybe(r['FechaFirmaAirtable']);

        detRows.push({
          Asesora: spec.nombre,
          'Atribuida por': det.via === 'cupon' ? 'Cupón' : 'Preowner',
          'ID solicitud': r['Id'],
          Fecha: fmtDate(fecha),
          Estado: estado,
          EstadoSolicitudAirtable: airt,
          'AE (Aprobado + Entregada)': estado.toLowerCase() === 'aprobado' && airt.toLowerCase() === 'entregada' ? 'Sí' : '',
          FechaFirmaAirtable: fFirma ? fmtDate(fFirma) : '',
          Cupón: cupon,
          Preowner: preowner,
          Nombres: r['Nombres'],
          Dni: r['Dni'],
          Institución: r['Institución'],
          Monto_prestamo: r['Monto_prestamo'],
          Procesador: r['Procesador'],
          Celular: r['Celular'],
          Departamento: r['Departamento'],
          Vendedores: r['Vendedores'],
          Owner: r['Owner'],
          Correo: r['Correo'],
        });
      }
      // Orden: asesora alfabético, luego fecha asc
      detRows.sort((a, b) =>
        (a.Asesora as string).localeCompare(b.Asesora as string) || String(a.Fecha).localeCompare(String(b.Fecha)),
      );
      const tab = `Solicitudes ${MES_LABEL[mesFiltro].slice(0, 3)}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detRows), tab);
    } catch (err) {
      console.error('[export] no pude generar detalle solicitudes:', err);
    }
  }

  // ============== Hoja 6: Detalle Blip — filtrado por mes si aplica ==============
  if (blipBuf) {
    try {
      const txt = stripBom(blipBuf.toString('utf-8'));
      const wbBlip = XLSX.read(txt, { type: 'string', FS: ';', raw: true });
      const wsBlipOrig = wbBlip.Sheets[wbBlip.SheetNames[0]];
      if (wsBlipOrig) {
        if (mesFiltro) {
          const mm = MES_NUM[mesFiltro];
          const all = XLSX.utils.sheet_to_json<Record<string, any>>(wsBlipOrig, { defval: '', raw: true });
          const filtered = all.filter(r => {
            const sd = String(r['StorageDate'] ?? '');
            const match = /^(\d{4})-(\d{2})/.exec(sd);
            return match && match[1] === '2026' && match[2] === mm;
          });
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered), 'Detalle Blip');
        } else {
          XLSX.utils.book_append_sheet(wb, wsBlipOrig, 'Detalle Blip');
        }
      }
    } catch (err) {
      console.error('[export] no pude leer Blip CSV:', err);
    }
  }

  // ============== Hoja 7: Detalle Admin — filtrado por mes si aplica ==============
  if (adminBuf) {
    try {
      const wbAdmin = XLSX.read(adminBuf, { type: 'buffer', cellDates: true });
      const wsAdminOrig = wbAdmin.Sheets[wbAdmin.SheetNames[0]];
      if (wsAdminOrig) {
        if (mesFiltro) {
          const mm = MES_NUM[mesFiltro];
          const all = XLSX.utils.sheet_to_json<Record<string, any>>(wsAdminOrig, { defval: null, raw: true });
          const filtered = all.filter(r => {
            const d = parseDateMaybe(r['Fecha']);
            if (!d) return false;
            return String(d.getMonth() + 1).padStart(2, '0') === mm && d.getFullYear() === 2026;
          });
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered), 'Detalle Admin');
        } else {
          XLSX.utils.book_append_sheet(wb, wsAdminOrig, 'Detalle Admin');
        }
      }
    } catch (err) {
      console.error('[export] no pude leer Admin XLSX:', err);
    }
  }

  // Serializar y devolver
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const stamp = mesFiltro ? mesFiltro : new Date().toISOString().slice(0, 10);
  const filename = `baldecash-sae-${stamp}.xlsx`;
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

function parseDateMaybe(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
