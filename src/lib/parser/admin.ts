// ============================================================
// Parser server-side del XLSX de DATA ADMIN (reporte_solicitudes.xlsx)
// ============================================================
// Lee solicitudes ingresadas, AE por cupón y AE por preowner, con la regla
// de atribución (cupón primario, preowner secundario, sin doble conteo).
//
// Reglas de agrupación temporal:
//   - Solicitudes (sol) → mes de `Fecha` (creación de la solicitud).
//   - AE (aeCup, aePre, aePorDia) → mes de `FechaFirmaAirtable` (entrega).
//     Si esa columna está vacía o cae fuera del rango soportado, la AE cae
//     al mes de `Fecha` como fallback. Esto refleja que la comisión del mes
//     debe contar lo que efectivamente se entregó en el mes, no lo que se
//     ingresó (una solicitud creada el 30-abr y entregada el 02-may cuenta
//     como AE de mayo, no de abril).

import * as XLSX from 'xlsx';
import { detectarAgenteAdmin } from '@/lib/domain/agentes';
import { MES_MAP } from '@/lib/domain/meses';
import type { AgenteSlug, MesKey } from '@/lib/domain/types';

interface AdminAcc {
  sol: number;
  aeCup: number;
  aePre: number;
  aePorDia: Map<string, number>;
}

const newAcc = (): AdminAcc => ({ sol: 0, aeCup: 0, aePre: 0, aePorDia: new Map() });

export interface AdminResultado {
  porAgenteMes: Map<AgenteSlug, Map<MesKey, AdminAcc>>;
  filasLeidas: number;
  filasDescartadas: { sinFecha: number; fueraDeRango: number };
  rangoMeses: Set<MesKey>;
}

export function parseAdminXlsx(buffer: ArrayBuffer | Uint8Array): AdminResultado {
  // SheetJS detecta el tipo automáticamente con type: 'array' para ArrayBuffer/Uint8Array.
  // Funciona idéntico en server y browser.
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('XLSX vacío: no se encontró ninguna hoja.');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
  if (rows.length === 0) {
    return { porAgenteMes: new Map(), filasLeidas: 0, filasDescartadas: { sinFecha: 0, fueraDeRango: 0 }, rangoMeses: new Set() };
  }

  // Normalizar nombres de columnas — buscamos las que necesitamos exactamente.
  // Las columnas requeridas son: Fecha, Cupón, Preowner, Estado, EstadoSolicitudAirtable.
  const sample = rows[0];
  const keys = Object.keys(sample);
  const find = (target: string): string | null => {
    const exact = keys.find(k => k === target);
    if (exact) return exact;
    const norm = target.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const fuzzy = keys.find(k => k.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') === norm);
    return fuzzy ?? null;
  };

  const kFecha    = find('Fecha');
  const kCupon    = find('Cupón');
  const kPreowner = find('Preowner');
  const kEstado   = find('Estado');
  const kAirt     = find('EstadoSolicitudAirtable');
  // FechaFirmaAirtable es opcional: si está presente, se usa para agrupar las
  // AE en el mes de entrega (no en el mes de creación de la solicitud). Si
  // falta, las AE caen al mes de Fecha (comportamiento previo).
  const kFirma    = find('FechaFirmaAirtable');
  const faltan = (
    [
      ['Fecha', kFecha], ['Cupón', kCupon], ['Preowner', kPreowner],
      ['Estado', kEstado], ['EstadoSolicitudAirtable', kAirt],
    ] as const
  ).filter(([, v]) => !v).map(([k]) => k);
  if (faltan.length > 0) {
    throw new Error(
      `XLSX de Admin inválido: faltan columnas ${faltan.join(', ')}. Columnas detectadas: ${keys.slice(0, 12).join(', ')}…`,
    );
  }

  const porAgenteMes = new Map<AgenteSlug, Map<MesKey, AdminAcc>>();
  const rangoMeses = new Set<MesKey>();
  let filasLeidas = 0, sinFecha = 0, fueraDeRango = 0;

  for (const r of rows) {
    filasLeidas++;
    const fecha = r[kFecha!];
    const dt = toDate(fecha);
    if (!dt) { sinFecha++; continue; }

    const mesISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const mes = MES_MAP[mesISO];
    if (!mes) { fueraDeRango++; continue; }

    rangoMeses.add(mes);

    const cupon    = (r[kCupon!]    == null ? '' : String(r[kCupon!]).trim());
    const preowner = (r[kPreowner!] == null ? '' : String(r[kPreowner!]).trim());
    const estado   = (r[kEstado!]   == null ? '' : String(r[kEstado!]).trim().toLowerCase());
    const airt     = (r[kAirt!]     == null ? '' : String(r[kAirt!]).trim().toLowerCase());

    const isAE = estado === 'aprobado' && airt === 'entregada';
    const det = detectarAgenteAdmin(cupon, preowner);
    if (!det) continue;

    let porMes = porAgenteMes.get(det.slug);
    if (!porMes) { porMes = new Map(); porAgenteMes.set(det.slug, porMes); }
    const accFor = (mk: MesKey): AdminAcc => {
      let a = porMes!.get(mk);
      if (!a) { a = newAcc(); porMes!.set(mk, a); }
      return a;
    };
    const accCreacion = accFor(mes);

    // Solicitudes ingresadas → siempre en el mes de creación
    if (det.via === 'cupon') accCreacion.sol++;

    if (isAE) {
      // AE → en el mes de FechaFirmaAirtable (entrega), si está disponible.
      // Si falta o cae fuera de rango (MES_MAP), cae al mes de creación.
      let mesAE = mes;
      let dtAE = dt;
      if (kFirma) {
        const dtFirma = toDate(r[kFirma]);
        if (dtFirma) {
          const mfISO = `${dtFirma.getFullYear()}-${String(dtFirma.getMonth() + 1).padStart(2, '0')}`;
          const mf = MES_MAP[mfISO];
          if (mf) { mesAE = mf; dtAE = dtFirma; rangoMeses.add(mf); }
        }
      }
      const accAE = accFor(mesAE);
      if (det.via === 'cupon') accAE.aeCup++;
      else accAE.aePre++;

      const day = `${String(dtAE.getDate()).padStart(2, '0')}-${String(dtAE.getMonth() + 1).padStart(2, '0')}`;
      accAE.aePorDia.set(day, (accAE.aePorDia.get(day) ?? 0) + 1);
    }
  }

  return {
    porAgenteMes,
    filasLeidas,
    filasDescartadas: { sinFecha, fueraDeRango },
    rangoMeses,
  };
}

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
    if (m) {
      const dt = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  if (typeof v === 'number') {
    // Excel serial date — XLSX con cellDates:true no debería llegar acá, pero por si acaso
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(v));
    return epoch;
  }
  return null;
}
