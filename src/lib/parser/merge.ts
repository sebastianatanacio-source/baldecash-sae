// ============================================================
// Merge incremental de snapshots
// ============================================================
// Combina dos snapshots respetando la siguiente regla:
//   - Para cada mes presente en el snapshot NUEVO, esos datos
//     reemplazan los del viejo (incluye meses, diario y métricas).
//   - Meses que solo están en el snapshot VIEJO se preservan tal cual.
//   - meta.totales se recalcula sobre el resultado final.
//
// Motivo: el export de Blip (AgentHistory / TicketHistory) trae los
// últimos ~90 días y se va achicando con el tiempo. Sin merge,
// cada carga descartaba los meses históricos.

import { ordenarMeses } from '@/lib/domain/meses';
import type {
  AgenteData,
  AgenteSlug,
  DataSnapshot,
  DistribucionHora,
  MesKey,
  MetricasMes,
  SerieDiariaPunto,
} from '@/lib/domain/types';

export interface MergeResumen {
  mesesPrevios: MesKey[];
  mesesEnNueva: MesKey[];
  mesesPreservados: MesKey[];
  mesesReemplazados: MesKey[];
  mesesNuevos: MesKey[];
}

export function mergeSnapshots(
  prev: DataSnapshot | null,
  next: DataSnapshot,
): { snapshot: DataSnapshot; resumen: MergeResumen } {
  // Caso inicial: no había snapshot previo → guardamos el nuevo tal cual
  if (!prev) {
    return {
      snapshot: next,
      resumen: {
        mesesPrevios: [],
        mesesEnNueva: [...next.meta.meses],
        mesesPreservados: [],
        mesesReemplazados: [],
        mesesNuevos: [...next.meta.meses],
      },
    };
  }

  const prevMeses = new Set(prev.meta.meses);
  const nextMeses = new Set(next.meta.meses);
  const reemplazados: MesKey[] = [...nextMeses].filter(m => prevMeses.has(m));
  const nuevos: MesKey[] = [...nextMeses].filter(m => !prevMeses.has(m));
  const preservados: MesKey[] = [...prevMeses].filter(m => !nextMeses.has(m));

  const allSlugs = new Set<AgenteSlug>([
    ...(Object.keys(prev.agentes) as AgenteSlug[]),
    ...(Object.keys(next.agentes) as AgenteSlug[]),
  ]);

  const mergedAgentes: Partial<Record<AgenteSlug, AgenteData>> = {};

  for (const slug of allSlugs) {
    const prevAg = prev.agentes[slug];
    const nextAg = next.agentes[slug];

    if (!prevAg && nextAg) { mergedAgentes[slug] = nextAg; continue; }
    if (prevAg && !nextAg) { mergedAgentes[slug] = prevAg; continue; }
    if (!prevAg || !nextAg) continue;

    // Meses: nuevo sobreescribe, viejo se mantiene si no está en nuevo
    const meses: Partial<Record<MesKey, MetricasMes>> = { ...prevAg.meses };
    for (const k of Object.keys(nextAg.meses) as MesKey[]) {
      const m = nextAg.meses[k];
      if (m) meses[k] = m;
    }

    // Diario: misma lógica
    const diario: Partial<Record<MesKey, SerieDiariaPunto[]>> = { ...prevAg.diario };
    for (const k of Object.keys(nextAg.diario) as MesKey[]) {
      const d = nextAg.diario[k];
      if (d) diario[k] = d;
    }

    // Horario: agregamos new + lo del viejo *proporcional* a los meses preservados.
    // Como no guardamos horario per-mes, hacemos una aproximación segura:
    //   - Si el viejo tenía horario, escalamos por la fracción de meses
    //     preservados sobre el total previo (atenuamos el aporte de meses
    //     reemplazados sin perderlo del todo).
    //   - Sumamos el horario del nuevo encima.
    const horario = combinarHorario(prevAg.horario, nextAg.horario, prev.meta.meses, reemplazados);

    mergedAgentes[slug] = {
      slug: prevAg.slug,
      nombre: nextAg.nombre || prevAg.nombre,
      cupon: nextAg.cupon || prevAg.cupon,
      initials: nextAg.initials || prevAg.initials,
      meses,
      diario,
      horario,
    };
  }

  // Recalcular meta.totales sobre los datos mergeados
  let atenciones = 0, solicitudes = 0, ae = 0;
  const mesesFinales = new Set<MesKey>();
  for (const ag of Object.values(mergedAgentes)) {
    if (!ag) continue;
    for (const [k, m] of Object.entries(ag.meses)) {
      if (!m) continue;
      mesesFinales.add(k as MesKey);
      atenciones += m.aten;
      solicitudes += m.sol;
      ae += m.aeTot;
    }
  }

  const snapshot: DataSnapshot = {
    version: 1,
    meta: {
      generadoEn: next.meta.generadoEn,
      generadoPor: next.meta.generadoPor,
      archivoBlip: next.meta.archivoBlip,
      archivoAdmin: next.meta.archivoAdmin,
      meses: ordenarMeses([...mesesFinales]),
      totales: { atenciones, solicitudes, ae },
    },
    agentes: mergedAgentes,
  };

  return {
    snapshot,
    resumen: {
      mesesPrevios: [...prev.meta.meses],
      mesesEnNueva: [...next.meta.meses],
      mesesPreservados: preservados,
      mesesReemplazados: reemplazados,
      mesesNuevos: nuevos,
    },
  };
}

function combinarHorario(
  prev: DistribucionHora | undefined,
  next: DistribucionHora | undefined,
  prevMeses: MesKey[],
  reemplazados: MesKey[],
): DistribucionHora {
  const hora = new Array<number>(24).fill(0);
  if (!prev && !next) return { hora };

  if (prev) {
    // Si los meses del snapshot previo están todos siendo reemplazados,
    // descartamos su contribución para no double-count.
    const totalPrev = prevMeses.length;
    const reemp = reemplazados.length;
    const factor = totalPrev > 0 ? Math.max(0, (totalPrev - reemp) / totalPrev) : 0;
    if (factor > 0) {
      for (let h = 0; h < 24; h++) hora[h] += Math.round((prev.hora[h] ?? 0) * factor);
    }
  }
  if (next) {
    for (let h = 0; h < 24; h++) hora[h] += next.hora[h] ?? 0;
  }
  return { hora };
}
