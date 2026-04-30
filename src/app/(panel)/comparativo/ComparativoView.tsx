'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Chips';
import BarChart from '@/components/charts/BarChart';
import { AGENTES_LIST } from '@/lib/domain/agentes';
import { MES_LABEL, MES_LABEL_CORTO } from '@/lib/domain/meses';
import { calcularComision, calcularVieja, formatSol } from '@/lib/domain/comisiones';
import { fechaCorta, nf } from '@/lib/domain/helpers';
import type { ComisionConfig, DataSnapshot, MesKey } from '@/lib/domain/types';

export default function ComparativoView({ snapshot, config }: { snapshot: DataSnapshot; config: ComisionConfig }) {
  const meses = snapshot.meta.meses;
  const [base, setBase] = useState<number>(config.baseSol);

  const cfgEffective = { ...config, baseSol: base };

  // Filas: por cada agente con datos, una fila por mes con comisión vieja vs nueva
  const filas = useMemo(() => {
    const out: Array<{ slug: string; nombre: string; color: string; mes: MesKey; vieja: number; nueva: number; aeTot: number; pctSol: number; }> = [];
    for (const spec of AGENTES_LIST) {
      const ag = snapshot.agentes[spec.slug];
      if (!ag) continue;
      for (const m of meses) {
        const met = ag.meses[m];
        if (!met) continue;
        const vieja = calcularVieja(met, cfgEffective);
        const nueva = calcularComision(met.aeTot, met.pctSol, cfgEffective).total;
        out.push({ slug: spec.slug, nombre: spec.nombre, color: spec.color, mes: m, vieja, nueva, aeTot: met.aeTot, pctSol: met.pctSol });
      }
    }
    return out;
  }, [snapshot, meses, cfgEffective]);

  const totalesPorAgente = useMemo(() => {
    const map = new Map<string, { spec: typeof AGENTES_LIST[0]; vieja: number; nueva: number; meses: typeof filas }>();
    for (const f of filas) {
      const spec = AGENTES_LIST.find(a => a.slug === f.slug)!;
      const acc = map.get(f.slug) ?? { spec, vieja: 0, nueva: 0, meses: [] };
      acc.vieja += f.vieja;
      acc.nueva += f.nueva;
      acc.meses.push(f);
      map.set(f.slug, acc);
    }
    return [...map.values()];
  }, [filas]);

  const totEquipo = totalesPorAgente.reduce(
    (acc, t) => ({ vieja: acc.vieja + t.vieja, nueva: acc.nueva + t.nueva }),
    { vieja: 0, nueva: 0 },
  );

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow mb-2">Esquemas de comisión</p>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">
            Comparativo del esquema antiguo vs nuevo
          </h1>
          <p className="text-[13.5px] text-muted mt-2 max-w-3xl">
            Análisis del impacto en la comisión total al migrar del esquema por AE individual al nuevo modelo de doble pilar.
            Ajusta la base mensual para entender la sensibilidad del nuevo esquema.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-line rounded-xl px-4 py-2.5">
          <label className="text-[12px] font-semibold text-ink2 whitespace-nowrap">Base mensual (S/)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={base}
            onChange={e => setBase(Number(e.target.value || 0))}
            className="input-field w-32 !py-1.5 !px-3 font-display font-semibold tabular"
          />
        </div>
      </header>

      {/* RESUMEN ESQUEMAS */}
      <section className="grid lg:grid-cols-2 gap-5">
        <Card className="bg-bg/40">
          <CardHeader
            eyebrow="Esquema anterior"
            title="Por AE individual"
            subtitle="Vigente hasta marzo 2026"
            right={<Pill>Histórico</Pill>}
          />
          <ul className="space-y-2 text-[13px] text-ink2">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted2 mt-2 shrink-0" />
              <span><strong className="text-ink tabular">{formatSol(config.viejaCupon)}</strong> por cada AE atribuida por cupón propio.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted2 mt-2 shrink-0" />
              <span><strong className="text-ink tabular">{formatSol(config.viejaPreowner)}</strong> por cada AE con preowner sin cupón propio.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted2 mt-2 shrink-0" />
              <span>Si la solicitud tiene cupón <em>y</em> preowner del mismo asesor, gana el cupón (no se duplica).</span>
            </li>
          </ul>
        </Card>
        <Card className="bg-blue-700/[.02] border-blue-700/15">
          <CardHeader
            eyebrow="Esquema propuesto"
            title="Doble pilar — Volumen + Productividad"
            subtitle="Vigente desde abril 2026"
            right={<Pill tone="aqua">Vigente</Pill>}
          />
          <ul className="space-y-2 text-[13px] text-ink2">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-aqua-600 mt-2 shrink-0" />
              <span><strong className="text-ink">Pilar 1:</strong> Total AE (cupón + preowner) → base mensual × multiplicador escalonado.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-gold-500 mt-2 shrink-0" />
              <span><strong className="text-ink">Pilar 2:</strong> % Sol/Atenciones → bono fijo por tramo de productividad.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-blue-700 mt-2 shrink-0" />
              <span>Comisión final = Base × Multiplicador del Pilar 1 + Bono del Pilar 2.</span>
            </li>
          </ul>
        </Card>
      </section>

      {/* TOTALES */}
      <section className="grid lg:grid-cols-2 gap-5">
        {totalesPorAgente.map(t => (
          <Card key={t.spec.slug}>
            <CardHeader
              eyebrow={t.spec.cupon || 'Asesora'}
              title={t.spec.nombre}
              subtitle={`Comisión total acumulada · ${MES_LABEL[meses[0]]} – ${MES_LABEL[meses[meses.length - 1]]}`}
              right={<span className="w-3 h-3 rounded-full" style={{ background: t.spec.color }} />}
            />
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div className="rounded-xl bg-bg/40 border border-line p-4">
                <p className="eyebrow mb-1.5">Esquema antiguo</p>
                <div className="font-display text-[24px] font-semibold tabular text-ink2">{formatSol(t.vieja)}</div>
              </div>
              <div className="rounded-xl border-2 p-4" style={{ borderColor: t.spec.color, background: t.spec.color + '0F' }}>
                <p className="eyebrow mb-1.5" style={{ color: t.spec.color }}>Esquema nuevo</p>
                <div className="font-display text-[24px] font-semibold tabular" style={{ color: t.spec.color }}>{formatSol(t.nueva)}</div>
              </div>
            </div>
            <div className="text-[12px] text-muted mb-4">
              Variación:{' '}
              <strong className={t.nueva >= t.vieja ? 'text-aqua-700' : 'text-gold-700'}>
                {t.nueva >= t.vieja ? '+' : ''}
                {formatSol(t.nueva - t.vieja)}
              </strong>{' '}
              ({t.vieja > 0 ? `${((t.nueva - t.vieja) / t.vieja * 100).toFixed(1)}%` : '—'})
            </div>
            <BarChart
              labels={t.meses.map(m => MES_LABEL_CORTO[m.mes])}
              series={[
                { label: 'Antiguo', data: t.meses.map(m => m.vieja), color: '#9CA3C5' },
                { label: 'Nuevo',   data: t.meses.map(m => m.nueva), color: t.spec.color },
              ]}
              legend
              height={180}
            />
          </Card>
        ))}
      </section>

      {/* TABLA DETALLE */}
      <Card padding="p-0">
        <div className="px-6 pt-6 pb-4 border-b border-line">
          <CardHeader
            eyebrow="Detalle"
            title="Comparativo por mes y asesora"
            subtitle="Cálculo paralelo con la base actual del simulador"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">Asesora</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider">Mes</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">AE</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">% Sol</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Antiguo</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Nuevo</th>
                <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filas.map((f, i) => (
                <tr key={i} className="hover:bg-bg/60">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-6 rounded-full" style={{ background: f.color }} />
                      <span className="font-semibold text-ink">{f.nombre}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 uppercase tracking-wider text-[11px] text-muted2">{MES_LABEL_CORTO[f.mes]}</td>
                  <td className="px-3 py-3 text-right tabular">{f.aeTot}</td>
                  <td className="px-3 py-3 text-right tabular text-muted">{f.pctSol.toFixed(1)}%</td>
                  <td className="px-3 py-3 text-right tabular text-muted">{formatSol(f.vieja)}</td>
                  <td className="px-3 py-3 text-right tabular font-semibold text-ink">{formatSol(f.nueva)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`tabular font-semibold ${f.nueva >= f.vieja ? 'text-aqua-700' : 'text-gold-700'}`}>
                      {f.nueva >= f.vieja ? '+' : ''}
                      {formatSol(f.nueva - f.vieja)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-bg/60 font-semibold">
                <td className="px-6 py-3 text-ink uppercase tracking-wider text-[11px]" colSpan={4}>Total equipo</td>
                <td className="px-3 py-3 text-right tabular text-ink">{formatSol(totEquipo.vieja)}</td>
                <td className="px-3 py-3 text-right tabular text-ink">{formatSol(totEquipo.nueva)}</td>
                <td className="px-6 py-3 text-right">
                  <span className={`tabular font-semibold ${totEquipo.nueva >= totEquipo.vieja ? 'text-aqua-700' : 'text-gold-700'}`}>
                    {totEquipo.nueva >= totEquipo.vieja ? '+' : ''}
                    {formatSol(totEquipo.nueva - totEquipo.vieja)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <p className="text-[11px] text-muted2 text-center pt-2">
        Datos generados el {fechaCorta(snapshot.meta.generadoEn)}{snapshot.meta.generadoPor ? ` por ${snapshot.meta.generadoPor}` : ''}.
      </p>
    </div>
  );
}
