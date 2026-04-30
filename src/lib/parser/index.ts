// ============================================================
// Orquestador del pipeline: CSV Blip + XLSX Admin → DataSnapshot
// ============================================================

import { parseBlipCsv } from './blip';
import { parseAdminXlsx } from './admin';
import { AGENTES_LIST } from '@/lib/domain/agentes';
import { ordenarMeses } from '@/lib/domain/meses';
import type {
  AgenteData,
  AgenteSlug,
  DataSnapshot,
  MesKey,
  MetricasMes,
  SerieDiariaPunto,
} from '@/lib/domain/types';

export interface BuildSnapshotInput {
  csvBuffer: ArrayBuffer | Uint8Array | string;
  xlsxBuffer: ArrayBuffer | Uint8Array;
  archivoBlip?: string;
  archivoAdmin?: string;
  generadoPor?: string;
}

export interface BuildSnapshotReport {
  snapshot: DataSnapshot;
  warnings: string[];
  blip: { filasLeidas: number; descartadas: { sinAgente: number; fueraDeRango: number; fechaInvalida: number } };
  admin: { filasLeidas: number; descartadas: { sinFecha: number; fueraDeRango: number } };
}

export async function buildSnapshot(input: BuildSnapshotInput): Promise<BuildSnapshotReport> {
  const csvText =
    typeof input.csvBuffer === 'string'
      ? input.csvBuffer
      : new TextDecoder('utf-8').decode(
          input.csvBuffer instanceof Uint8Array
            ? input.csvBuffer
            : new Uint8Array(input.csvBuffer as ArrayBuffer),
        );

  const blip  = parseBlipCsv(stripBom(csvText));
  const admin = parseAdminXlsx(input.xlsxBuffer);

  const warnings: string[] = [];

  // Conjunto unificado de meses encontrados en cualquiera de las dos fuentes
  const mesesAll = new Set<MesKey>([...blip.rangoMeses, ...admin.rangoMeses]);
  const mesesOrdenados = ordenarMeses([...mesesAll]);

  const agentes: Partial<Record<AgenteSlug, AgenteData>> = {};

  for (const spec of AGENTES_LIST) {
    const blipMes = blip.porAgenteMes.get(spec.slug);
    const adminMes = admin.porAgenteMes.get(spec.slug);
    if (!blipMes && !adminMes) continue;

    const meses: Partial<Record<MesKey, MetricasMes>> = {};
    const diario: Partial<Record<MesKey, SerieDiariaPunto[]>> = {};
    const horaAcc = new Array<number>(24).fill(0);

    for (const mes of mesesOrdenados) {
      const b = blipMes?.get(mes);
      const a = adminMes?.get(mes);
      if (!b && !a) continue;

      const aten = b?.aten ?? 0;
      const deja = b?.deja ?? 0;
      const sol  = a?.sol  ?? 0;
      const aeCup = a?.aeCup ?? 0;
      const aePre = a?.aePre ?? 0;
      const aeTot = aeCup + aePre;
      const pctDeja = aten > 0 ? +(deja / aten * 100).toFixed(1) : 0;
      const pctSol  = aten > 0 ? +(sol  / aten * 100).toFixed(1) : 0;

      const qtAvg  = b && b.qtN  > 0 ? +(b.qtSum  / b.qtN ).toFixed(2) : 0;
      const frtAvg = b && b.frtN > 0 ? +(b.frtSum / b.frtN).toFixed(2) : 0;
      const artAvg = b && b.artN > 0 ? +(b.artSum / b.artN).toFixed(2) : 0;
      const frtMedianaSeg = b && b.frtSegs.length > 0 ? +mediana(b.frtSegs).toFixed(1) : 0;

      const canales = b?.canales ?? { whatsapp: 0, facebook: 0, otro: 0 };
      const tags = b
        ? [...b.tags.entries()]
            .sort((x, y) => y[1] - x[1])
            .slice(0, 8)
            .map(([tag, n]) => ({ tag, n }))
        : [];

      const cerradas    = b?.cerradas    ?? 0;
      const solucionadas = b?.solucionadas ?? 0;
      const noContesta   = b?.noContesta   ?? 0;
      const transferidas = b?.transferidas ?? 0;
      // % Resolución sobre contestadas: contestadas = cerradas - noContesta
      const contestadas = Math.max(0, cerradas - noContesta);
      const pctResolucion = contestadas > 0 ? +(solucionadas / contestadas * 100).toFixed(1) : 0;

      meses[mes] = {
        aten, deja, pctDeja,
        sol, aeCup, aePre, aeTot, pctSol,
        qtAvg, frtAvg, artAvg, frtMedianaSeg,
        canales, tags,
        cerradas, solucionadas, noContesta, transferidas, pctResolucion,
      };

      // Serie diaria: combinar atenciones/deja/solucionadas de Blip + AE de Admin por día
      const dias = new Map<string, SerieDiariaPunto>();
      if (b) {
        for (const [day, val] of b.diario) {
          dias.set(day, {
            day, aten: val.aten, deja: val.deja, ae: 0,
            cerradas: val.cerradas, solucionadas: val.solucionadas, dow: val.dow,
          });
        }
      }
      if (a) {
        for (const [day, ae] of a.aePorDia) {
          const existing = dias.get(day);
          if (existing) existing.ae = ae;
          else {
            const dow = dowFromDDMM(day, mes, mesesOrdenados);
            dias.set(day, { day, aten: 0, deja: 0, ae, cerradas: 0, solucionadas: 0, dow });
          }
        }
      }
      diario[mes] = [...dias.values()].sort((x, y) => x.day.localeCompare(y.day));

      if (b) for (let h = 0; h < 24; h++) horaAcc[h] += b.hora[h];
    }

    agentes[spec.slug] = {
      slug: spec.slug,
      nombre: spec.nombre,
      cupon: spec.cupon,
      initials: spec.initials,
      meses,
      diario,
      horario: { hora: horaAcc },
    };
  }

  // Totales globales para el meta
  let atenciones = 0, solicitudes = 0, ae = 0;
  for (const ag of Object.values(agentes)) {
    if (!ag) continue;
    for (const m of Object.values(ag.meses)) {
      if (!m) continue;
      atenciones += m.aten;
      solicitudes += m.sol;
      ae += m.aeTot;
    }
  }

  if (atenciones === 0) warnings.push('No se contabilizaron atenciones en Blip; revisa el archivo CSV.');
  if (solicitudes === 0) warnings.push('No se contabilizaron solicitudes en Admin; revisa el archivo XLSX.');

  const snapshot: DataSnapshot = {
    version: 1,
    meta: {
      generadoEn: new Date().toISOString(),
      generadoPor: input.generadoPor,
      archivoBlip: input.archivoBlip,
      archivoAdmin: input.archivoAdmin,
      meses: mesesOrdenados,
      totales: { atenciones, solicitudes, ae },
    },
    agentes,
  };

  return {
    snapshot,
    warnings,
    blip: { filasLeidas: blip.filasLeidas, descartadas: blip.filasDescartadas },
    admin: { filasLeidas: admin.filasLeidas, descartadas: admin.filasDescartadas },
  };
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function dowFromDDMM(ddmm: string, mes: MesKey, _ctx: MesKey[]): number {
  // Construye una fecha aproximada (asume 2026 — único año soportado actualmente).
  const [d, m] = ddmm.split('-').map(Number);
  const dt = new Date(2026, (m || 1) - 1, d || 1);
  return (dt.getDay() + 6) % 7;
}

/** Mediana numérica. Si arr está vacío, devuelve 0. */
function mediana(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
