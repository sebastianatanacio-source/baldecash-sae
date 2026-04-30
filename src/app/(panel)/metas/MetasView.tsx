'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Chips';
import { AGENTES_LIST } from '@/lib/domain/agentes';
import { MES_LABEL_CORTO } from '@/lib/domain/meses';
import { calcularComision, formatSol } from '@/lib/domain/comisiones';
import { fechaCorta } from '@/lib/domain/helpers';
import type { ComisionConfig, DataSnapshot } from '@/lib/domain/types';

export default function MetasView({ snapshot, config }: { snapshot: DataSnapshot; config: ComisionConfig }) {
  const ultMes = snapshot.meta.meses[snapshot.meta.meses.length - 1];

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow mb-2">Comisiones · Nuevo esquema</p>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">
          Pilares y simulador de comisiones
        </h1>
        <p className="text-[13.5px] text-muted mt-2 max-w-3xl">
          Estructura de doble pilar que premia volumen de aprobaciones y productividad sobre las atenciones del canal.
          Los tramos por defecto son configurables desde el panel de administración.
        </p>
      </header>

      {/* PILARES */}
      <section className="grid lg:grid-cols-2 gap-5">
        <PilarCard
          numero="Pilar 1"
          titulo="AE del mes × multiplicador"
          subtitulo="AE = cupón + preowner. Fuente: Admin"
          tone="aqua"
          tramos={config.pilar1.map(t => ({
            label: t.label,
            valor: `${t.mul.toFixed(2)}×`,
            sub: `Base × ${t.mul}`,
          }))}
        />
        <PilarCard
          numero="Pilar 2"
          titulo="% Sol / Atenciones → bono"
          subtitulo="Sol Admin (cupón) ÷ atenciones Blip"
          tone="gold"
          tramos={config.pilar2.map(t => ({
            label: t.label,
            valor: t.bono > 0 ? `+${formatSol(t.bono)}` : 'S/ 0',
            sub: t.bono === 0 ? 'sin bono' : 'bono',
          }))}
        />
      </section>

      <Card>
        <CardHeader
          eyebrow="Fórmula"
          title="Cálculo de la comisión final"
          subtitle="Comisión = Base mensual × Multiplicador del Pilar 1 + Bono del Pilar 2"
        />
        <div
          className="rounded-xl p-6 text-white grid sm:grid-cols-3 gap-4 text-center"
          style={{ background: 'linear-gradient(135deg, #151744, #31359C)' }}
        >
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-blue-200/80 mb-1.5">Base mensual</p>
            <div className="font-display text-[24px] font-semibold tabular">{formatSol(config.baseSol)}</div>
          </div>
          <div className="border-t sm:border-t-0 sm:border-l sm:border-r border-blue-300/20 pt-4 sm:pt-0">
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-blue-200/80 mb-1.5">Multiplicador (P1)</p>
            <div className="font-display text-[24px] font-semibold tabular">1.0× – 2.0×</div>
          </div>
          <div className="border-t sm:border-t-0 border-blue-300/20 pt-4 sm:pt-0">
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-blue-200/80 mb-1.5">Bono (P2)</p>
            <div className="font-display text-[24px] font-semibold tabular">
              S/ 0 – {formatSol(Math.max(...config.pilar2.map(t => t.bono)))}
            </div>
          </div>
        </div>
      </Card>

      {/* CALCULADORA */}
      <Card>
        <CardHeader
          eyebrow="Simulador"
          title="Calculadora de comisión"
          subtitle="Ajusta AE y % Sol/Atenciones para proyectar la comisión de cada asesora"
        />
        <Calculadora snapshot={snapshot} config={config} />
      </Card>

      {/* HISTÓRICO ÚLTIMO MES */}
      {ultMes && (
        <Card>
          <CardHeader
            eyebrow="Cierre más reciente"
            title={`Comisión del último mes con datos`}
            subtitle="Cálculo automático con los valores actuales del esquema"
          />
          <HistoricoUltimoMes snapshot={snapshot} config={config} />
        </Card>
      )}

      <p className="text-[11px] text-muted2 text-center pt-2">
        Datos generados el {fechaCorta(snapshot.meta.generadoEn)}{snapshot.meta.generadoPor ? ` por ${snapshot.meta.generadoPor}` : ''}.
      </p>
    </div>
  );
}

function PilarCard({
  numero, titulo, subtitulo, tramos, tone,
}: {
  numero: string; titulo: string; subtitulo: string; tone: 'aqua' | 'gold';
  tramos: { label: string; valor: string; sub: string }[];
}) {
  const accent = tone === 'aqua' ? '#00A29B' : '#D1A646';
  const accentSoft = tone === 'aqua' ? '#E0F1F3' : '#FFF7E6';

  return (
    <Card>
      <header className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: accentSoft }}>
          <span className="font-display font-bold text-[16px]" style={{ color: accent }}>
            {numero.replace('Pilar ', '')}
          </span>
        </div>
        <div>
          <p className="eyebrow">{numero}</p>
          <h3 className="font-display text-[16px] font-semibold text-ink">{titulo}</h3>
          <p className="text-[11.5px] text-muted">{subtitulo}</p>
        </div>
      </header>
      <div className="space-y-2">
        {tramos.map((t, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl px-4 py-3 border"
            style={{
              background: i === tramos.length - 1 ? accentSoft : '#FAFBFE',
              borderColor: i === tramos.length - 1 ? accent : '#E4E7F2',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full" style={{ background: accent, opacity: 0.3 + (i / tramos.length) * 0.7 }} />
              <span className="text-[12.5px] font-semibold text-ink2">{t.label}</span>
            </div>
            <div className="text-right">
              <div className="font-display text-[16px] font-semibold tabular" style={{ color: accent }}>
                {t.valor}
              </div>
              <div className="text-[10.5px] text-muted2 mt-0.5">{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Calculadora({ snapshot, config }: { snapshot: DataSnapshot; config: ComisionConfig }) {
  const [base, setBase] = useState<number>(config.baseSol);

  return (
    <div>
      <div className="flex items-center gap-3 bg-bg/60 rounded-xl px-4 py-3 mb-5 max-w-md">
        <label className="text-[12px] font-semibold text-ink2 whitespace-nowrap">Base mensual (S/)</label>
        <input
          type="number"
          min={0}
          max={20000}
          step={100}
          value={base}
          onChange={e => setBase(Number(e.target.value || 0))}
          className="input-field flex-1"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(spec => {
          const ag = snapshot.agentes[spec.slug]!;
          const meses = snapshot.meta.meses.filter(m => ag.meses[m]);
          const ult = meses[meses.length - 1];
          return (
            <CalculadoraAgente
              key={spec.slug}
              spec={spec}
              base={base}
              config={config}
              defaultAE={ag.meses[ult]?.aeTot ?? 0}
              defaultPct={ag.meses[ult]?.pctSol ?? 0}
              historico={meses.map(m => ({ mes: MES_LABEL_CORTO[m], ae: ag.meses[m]!.aeTot, pct: ag.meses[m]!.pctSol }))}
            />
          );
        })}
      </div>
    </div>
  );
}

function CalculadoraAgente({
  spec, base, config, defaultAE, defaultPct, historico,
}: {
  spec: { slug: string; nombre: string; cupon: string; initials: string; color: string };
  base: number;
  config: ComisionConfig;
  defaultAE: number;
  defaultPct: number;
  historico: { mes: string; ae: number; pct: number }[];
}) {
  const [ae, setAE] = useState<number>(defaultAE);
  const [pctSol, setPctSol] = useState<number>(defaultPct);

  const calculo = useMemo(() => calcularComision(ae, pctSol, { ...config, baseSol: base }),
    [ae, pctSol, base, config]);

  return (
    <div className="border-2 rounded-2xl p-5" style={{ borderColor: spec.color }}>
      <header className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold text-[14px]"
          style={{ background: spec.color }}
        >
          {spec.initials}
        </div>
        <div>
          <div className="font-semibold text-ink text-[14px]">{spec.nombre}</div>
          <code className="text-[11px] text-muted">{spec.cupon}</code>
        </div>
      </header>

      <div className="space-y-4 mb-5">
        <div>
          <label className="eyebrow block mb-1.5">AE del mes</label>
          <input
            type="number"
            min={0}
            value={ae}
            onChange={e => setAE(Math.max(0, Number(e.target.value || 0)))}
            className="input-field font-display text-[18px] font-semibold tabular"
          />
          {historico.length > 0 && (
            <p className="text-[11px] text-muted2 mt-1.5">
              Histórico:{' '}
              {historico.map((h, i) => (
                <span key={h.mes}>
                  {i > 0 && ' · '}
                  <button
                    type="button"
                    onClick={() => setAE(h.ae)}
                    className="text-blue-500 hover:text-blue-700 hover:underline"
                  >
                    {h.mes} <strong>{h.ae}</strong>
                  </button>
                </span>
              ))}
            </p>
          )}
        </div>
        <div>
          <label className="eyebrow block mb-1.5">% Sol / Atenciones</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={pctSol}
            onChange={e => setPctSol(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
            className="input-field font-display text-[18px] font-semibold tabular"
          />
          {historico.length > 0 && (
            <p className="text-[11px] text-muted2 mt-1.5">
              Histórico:{' '}
              {historico.map((h, i) => (
                <span key={h.mes}>
                  {i > 0 && ' · '}
                  <button
                    type="button"
                    onClick={() => setPctSol(h.pct)}
                    className="text-blue-500 hover:text-blue-700 hover:underline"
                  >
                    {h.mes} <strong>{h.pct.toFixed(1)}%</strong>
                  </button>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl p-4 text-white" style={{ background: '#151744' }}>
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-blue-200/80 mb-1">Comisión proyectada</p>
        <div className="font-display text-[30px] font-semibold tabular leading-none">{formatSol(calculo.total)}</div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Pill tone="aqua" className="!bg-aqua-600/15 !border-aqua-500/30 !text-aqua-200">
            P1: {formatSol(calculo.pilar1.aplicado)} · {calculo.pilar1.tramo.mul}×
          </Pill>
          <Pill tone="gold" className="!bg-gold-500/15 !border-gold-400/30 !text-gold-200">
            P2: {calculo.pilar2.aplicado === 0 ? 'sin bono' : `+${formatSol(calculo.pilar2.aplicado)}`}
          </Pill>
        </div>
      </div>
    </div>
  );
}

function HistoricoUltimoMes({ snapshot, config }: { snapshot: DataSnapshot; config: ComisionConfig }) {
  const ult = snapshot.meta.meses[snapshot.meta.meses.length - 1];
  const filas = AGENTES_LIST
    .filter(a => snapshot.agentes[a.slug])
    .map(spec => {
      const m = snapshot.agentes[spec.slug]!.meses[ult];
      if (!m) return null;
      const c = calcularComision(m.aeTot, m.pctSol, config);
      return { spec, m, c };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider">Asesora</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">AE</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">% Sol</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Multiplicador</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Pilar 1</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Pilar 2</th>
            <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filas.map(({ spec, m, c }) => (
            <tr key={spec.slug} className="hover:bg-bg/60">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-7 rounded-full" style={{ background: spec.color }} />
                  <span className="font-semibold text-ink">{spec.nombre}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-right tabular">{m.aeTot}</td>
              <td className="px-3 py-3 text-right tabular text-muted">{m.pctSol.toFixed(1)}%</td>
              <td className="px-3 py-3 text-right tabular">{c.pilar1.tramo.mul}×</td>
              <td className="px-3 py-3 text-right tabular">{formatSol(c.pilar1.aplicado)}</td>
              <td className="px-3 py-3 text-right tabular">{formatSol(c.pilar2.aplicado)}</td>
              <td className="px-4 py-3 text-right">
                <span className="font-display font-semibold text-ink tabular">{formatSol(c.total)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
