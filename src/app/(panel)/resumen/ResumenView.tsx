'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/Card';
import { Kpi, KpiCompact } from '@/components/ui/Kpi';
import { ChipGroup, Pill } from '@/components/ui/Chips';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import { AGENTES, AGENTES_LIST } from '@/lib/domain/agentes';
import { MES_LABEL_CORTO, MES_LABEL } from '@/lib/domain/meses';
import {
  calcularComision, calcularComisionLuz, calcularComisionPorAgente, formatSol,
  proximoTramoP1, proximoTramoP2, progresoTramo, tramoP1, tramoP2,
} from '@/lib/domain/comisiones';
import { esBlipOnly } from '@/lib/domain/agentes';
import {
  combinarMetricas, fechaCorta, mesActual, metricasAgente, metricasEquipo,
  metricasMeta, nf, pct, solicitudesParaPct,
  diasTrabajados, diasTotalesDelMes, proyectarFinDeMes,
  tramosP1Para, tramosP2Para,
} from '@/lib/domain/helpers';
import type { ComisionConfig, DataSnapshot, MesKey } from '@/lib/domain/types';
import type { Rol } from '@/lib/auth/users';

type MesFiltro = MesKey | 'all';

export default function ResumenView({
  snapshot, rol, config,
}: { snapshot: DataSnapshot; rol: Rol; config: ComisionConfig }) {
  const meses = snapshot.meta.meses;
  const mesPorDefecto = mesActual(snapshot);
  const [mes, setMes] = useState<MesFiltro>('all');

  const equipo = useMemo(() => metricasEquipo(snapshot, mes), [snapshot, mes]);
  const equipoPrev = useMemo(() => {
    if (mes === 'all' || meses.length < 2) return null;
    const idx = meses.indexOf(mes as MesKey);
    if (idx <= 0) return null;
    return metricasEquipo(snapshot, meses[idx - 1]);
  }, [snapshot, mes, meses]);

  const fnDelta = (cur: number, prev: number | undefined): number | undefined => {
    if (prev == null || prev === 0) return undefined;
    return +(((cur - prev) / prev) * 100).toFixed(1);
  };

  const periodoLabel = mes === 'all'
    ? `${MES_LABEL[meses[0]]} – ${MES_LABEL[meses[meses.length - 1]]} 2026`
    : `${MES_LABEL[mes as MesKey]} 2026`;

  const chipOptions = [
    { value: 'all' as MesFiltro, label: 'Período completo' },
    ...meses.map(m => ({ value: m as MesFiltro, label: MES_LABEL_CORTO[m] })),
  ];

  // Series mensuales (siempre todos los meses, ignorando filtro de KPI)
  const equipoPorMes = meses.map(m => metricasEquipo(snapshot, m));

  return (
    <div className="space-y-7">
      {/* ============== HEADER PÁGINA ============== */}
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow mb-2">Reporte ejecutivo · {periodoLabel}</p>
          <h1 className="font-display text-[30px] font-semibold leading-tight text-ink">
            Atención y conversión del equipo SAE
          </h1>
          <p className="text-[13.5px] text-muted mt-2 max-w-2xl">
            Indicadores de canal Blip y solicitudes Admin consolidados por agente, con seguimiento de comisiones bajo el nuevo esquema.
          </p>
        </div>
        <ChipGroup options={chipOptions} value={mes} onChange={setMes} />
      </header>

      {/* ============== PROGRESO DEL EQUIPO — MES ACTUAL ============== */}
      {mesPorDefecto && (
        <ProgresoEquipo snapshot={snapshot} mes={mesPorDefecto} config={config} />
      )}

      {/* ============== KPIs HERO ============== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Atenciones Blip"
          value={nf(equipo.aten)}
          accent="#4453A0"
          size="lg"
          delta={equipoPrev ? { value: fnDelta(equipo.aten, equipoPrev.aten) ?? 0, positiveIsGood: true } : undefined}
          hint="Conversaciones cerradas en WhatsApp + canales adicionales"
        />
        <Kpi
          label="Solicitudes ingresadas"
          value={nf(equipo.sol)}
          accent="#00A29B"
          size="lg"
          delta={equipoPrev ? { value: fnDelta(equipo.sol, equipoPrev.sol) ?? 0, positiveIsGood: true } : undefined}
          hint="Atribuidas por cupón propio"
        />
        <Kpi
          label="Aprobadas y entregadas"
          value={nf(equipo.aeTot)}
          accent="#D1A646"
          size="lg"
          delta={equipoPrev ? { value: fnDelta(equipo.aeTot, equipoPrev.aeTot) ?? 0, positiveIsGood: true } : undefined}
          hint={`Cupón ${nf(equipo.aeCup)} · Preowner ${nf(equipo.aePre)}`}
        />
        <Kpi
          label="Conversión Sol / Aten"
          value={pct(equipo.pctSol, 1)}
          accent="#151744"
          size="lg"
          delta={equipoPrev ? { value: +((equipo.pctSol - equipoPrev.pctSol).toFixed(1)), positiveIsGood: true } : undefined}
          hint="Proxy de productividad para el Pilar 2"
        />
      </section>

      {/* ============== UNIVERSO BLIP / UNIVERSO ADMIN ============== */}
      <section className="grid lg:grid-cols-2 gap-5">
        {/* BLIP */}
        <Card>
          <CardHeader
            eyebrow="Universo Blip"
            title="Calidad y volumen del canal"
            subtitle="Atenciones, deja-solicitud y métricas operativas"
            right={<Pill tone="blue">Blip</Pill>}
          />
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KpiCompact label="Atenciones" value={nf(equipo.aten)} accent="#4453A0" />
            <KpiCompact label="Deja solicitud" value={nf(equipo.deja)} accent="#6873D7" />
            <KpiCompact label="% Deja-solicitud" value={pct(equipo.pctDeja, 1)} accent="#98A9DF" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <KpiCompact label="Cola promedio" value={nf(equipo.qtAvg, 1)} unit="min" accent="#36B7B3" />
            <KpiCompact label="1ª respuesta" value={nf(equipo.frtAvg, 2)} unit="min" accent="#00A29B" />
            <KpiCompact label="Resp. entre msgs" value={nf(equipo.artAvg, 1)} unit="min" accent="#007974" />
          </div>
          <div className="border-t border-line pt-5">
            <p className="eyebrow mb-3">Atenciones y deja-solicitud por mes</p>
            <BarChart
              labels={meses.map(m => MES_LABEL_CORTO[m])}
              series={[
                { label: 'Atenciones', data: equipoPorMes.map(m => m.aten), color: '#4453A0' },
                { label: 'Deja solicitud', data: equipoPorMes.map(m => m.deja), color: '#98A9DF' },
              ]}
              legend
              height={200}
            />
          </div>
        </Card>

        {/* ADMIN */}
        <Card>
          <CardHeader
            eyebrow="Universo Admin"
            title="Pipeline de solicitudes"
            subtitle="Solicitudes ingresadas y aprobadas-entregadas"
            right={<Pill tone="aqua">Admin</Pill>}
          />
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KpiCompact label="Solicitudes" value={nf(equipo.sol)} accent="#00A29B" />
            <KpiCompact label="AE Cupón" value={nf(equipo.aeCup)} accent="#36B7B3" />
            <KpiCompact label="AE Preowner" value={nf(equipo.aePre)} accent="#5CBFBE" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <KpiCompact label="AE total" value={nf(equipo.aeTot)} accent="#007974" />
            <KpiCompact label="Tasa AE / Sol" value={equipo.sol > 0 ? pct(equipo.aeTot / equipo.sol * 100) : '—'} accent="#212469" />
          </div>
          <div className="border-t border-line pt-5">
            <p className="eyebrow mb-3">Solicitudes vs AE por mes</p>
            <BarChart
              labels={meses.map(m => MES_LABEL_CORTO[m])}
              series={[
                { label: 'Solicitudes', data: equipoPorMes.map(m => m.sol), color: '#00A29B' },
                { label: 'AE total',    data: equipoPorMes.map(m => m.aeTot), color: '#D1A646' },
              ]}
              legend
              height={200}
            />
          </div>
        </Card>
      </section>

      {/* ============== REPARTO POR ASESORA ============== */}
      <Card>
        <CardHeader
          eyebrow="Distribución del equipo"
          title="Reparto por asesora"
          subtitle="Aporte individual sobre el total del período"
        />
        <div className="grid lg:grid-cols-3 gap-6">
          <div>
            <p className="eyebrow mb-3">Atenciones</p>
            <DonutChart
              labels={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => a.nombre)}
              values={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => metricasAgente(snapshot, a.slug, mes).aten)}
              colors={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => a.color)}
              centerLabel="Total"
              centerValue={nf(equipo.aten)}
              height={220}
            />
          </div>
          <div>
            <p className="eyebrow mb-3">Solicitudes</p>
            <DonutChart
              labels={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => a.nombre)}
              values={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => metricasAgente(snapshot, a.slug, mes).sol)}
              colors={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => a.color)}
              centerLabel="Total"
              centerValue={nf(equipo.sol)}
              height={220}
            />
          </div>
          <div>
            <p className="eyebrow mb-3">AE Total</p>
            <DonutChart
              labels={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => a.nombre)}
              values={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => metricasAgente(snapshot, a.slug, mes).aeTot)}
              colors={AGENTES_LIST.filter(a => snapshot.agentes[a.slug]).map(a => a.color)}
              centerLabel="Total"
              centerValue={nf(equipo.aeTot)}
              height={220}
            />
          </div>
        </div>
      </Card>

      {/* ============== TABLA RESUMEN ============== */}
      <Card padding="p-0">
        <div className="px-6 pt-6 pb-4 border-b border-line">
          <CardHeader
            eyebrow="Detalle"
            title="Resumen mensual consolidado"
            subtitle="Métricas reales extraídas de Blip AgentHistory + Admin reporte_solicitudes"
          />
        </div>
        <TablaResumen snapshot={snapshot} />
      </Card>

      {/* ============== TIPIFICACIONES ============== */}
      {equipo.tags.length > 0 && (
        <Card>
          <CardHeader
            eyebrow="Tipificaciones"
            title="Top de etiquetas de cierre"
            subtitle="Distribución de los cierres por motivo, sumando todo el equipo en el período seleccionado"
          />
          <Tipificaciones tags={equipo.tags} total={equipo.aten} />
        </Card>
      )}

      <p className="text-[11px] text-muted2 text-center pt-2">
        Datos generados el {fechaCorta(snapshot.meta.generadoEn)}{snapshot.meta.generadoPor ? ` por ${snapshot.meta.generadoPor}` : ''}.
      </p>
    </div>
  );
}

function TablaResumen({ snapshot }: { snapshot: DataSnapshot }) {
  const filas = AGENTES_LIST
    .filter(a => snapshot.agentes[a.slug])
    .flatMap(a => snapshot.meta.meses.map(m => {
      const met = snapshot.agentes[a.slug]!.meses[m];
      return { ag: a, mes: m, met };
    }))
    .filter(f => f.met);

  const tot = combinarMetricas(filas.map(f => f.met!));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">Asesora</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider">Mes</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Aten.</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Deja</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">% Deja</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Sol.</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">% Sol</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">AE Cup.</th>
            <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">AE Pre.</th>
            <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">AE Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filas.map(({ ag, mes, met }) => (
            <tr key={`${ag.slug}-${mes}`} className="hover:bg-bg/60 transition-colors">
              <td className="px-6 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-7 rounded-full" style={{ background: ag.color }} aria-hidden />
                  <span className="font-semibold text-ink">{ag.nombre}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-muted2 uppercase tracking-wider text-[11px]">{MES_LABEL_CORTO[mes]}</td>
              <td className="px-3 py-3 text-right tabular">{nf(met!.aten)}</td>
              <td className="px-3 py-3 text-right tabular">{nf(met!.deja)}</td>
              <td className="px-3 py-3 text-right tabular text-muted">{pct(met!.pctDeja, 1)}</td>
              <td className="px-3 py-3 text-right tabular">{nf(met!.sol)}</td>
              <td className="px-3 py-3 text-right tabular text-muted">{pct(met!.pctSol, 1)}</td>
              <td className="px-3 py-3 text-right tabular">{nf(met!.aeCup)}</td>
              <td className="px-3 py-3 text-right tabular">{nf(met!.aePre)}</td>
              <td className="px-6 py-3 text-right">
                <span className="font-display font-semibold text-ink tabular">{nf(met!.aeTot)}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-bg/60 font-semibold">
            <td className="px-6 py-3 text-ink uppercase tracking-wider text-[11px]">Total equipo</td>
            <td className="px-3 py-3" />
            <td className="px-3 py-3 text-right tabular text-ink">{nf(tot.aten)}</td>
            <td className="px-3 py-3 text-right tabular text-ink">{nf(tot.deja)}</td>
            <td className="px-3 py-3 text-right tabular text-muted">{pct(tot.pctDeja, 1)}</td>
            <td className="px-3 py-3 text-right tabular text-ink">{nf(tot.sol)}</td>
            <td className="px-3 py-3 text-right tabular text-muted">{pct(tot.pctSol, 1)}</td>
            <td className="px-3 py-3 text-right tabular text-ink">{nf(tot.aeCup)}</td>
            <td className="px-3 py-3 text-right tabular text-ink">{nf(tot.aePre)}</td>
            <td className="px-6 py-3 text-right">
              <span className="font-display font-semibold text-ink tabular">{nf(tot.aeTot)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ============================================================
// PROGRESO DEL EQUIPO — sección "Cómo van las chicas este mes"
// ============================================================
function ProgresoEquipo({
  snapshot, mes, config,
}: { snapshot: DataSnapshot; mes: MesKey; config: ComisionConfig }) {
  const asesoras = AGENTES_LIST.filter(a => snapshot.agentes[a.slug] && snapshot.agentes[a.slug]!.meses[mes]);
  if (asesoras.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-[22px] font-semibold text-ink mb-1.5">
        Cómo va el equipo en {MES_LABEL[mes]}
      </h2>
      <p className="text-[13px] text-muted mb-5 max-w-2xl">
        Progreso de cada asesora hacia su próximo tramo de comisión. El acumulado es lo que llevan al día de hoy; la proyección estima el cierre al ritmo actual.
      </p>

      <div className="grid lg:grid-cols-2 gap-4">
        {asesoras.map(spec => (
          <TarjetaAsesora key={spec.slug} spec={spec} snapshot={snapshot} mes={mes} config={config} />
        ))}
      </div>
    </section>
  );
}

function TarjetaAsesora({
  spec, snapshot, mes, config,
}: {
  spec: typeof AGENTES.fernanda; snapshot: DataSnapshot; mes: MesKey; config: ComisionConfig;
}) {
  const m = metricasAgente(snapshot, spec.slug, mes);
  const blipOnly = esBlipOnly(spec.slug);

  // Card específica para Luz — esquema todo o nada
  if (blipOnly) {
    return <TarjetaLuz spec={spec} snapshot={snapshot} mes={mes} config={config} m={m} />;
  }

  const meta = metricasMeta(spec.slug, m);
  const tramos1 = tramosP1Para(spec.slug, config);
  const tramos2 = tramosP2Para(spec.slug, config);

  const t1Actual = tramoP1(meta.pilar1Valor, tramos1);
  const t1Sig = proximoTramoP1(meta.pilar1Valor, tramos1);
  const t2Actual = tramoP2(meta.pilar2Valor, tramos2);
  const t2Sig = proximoTramoP2(meta.pilar2Valor, tramos2);

  const progP1 = progresoTramo(meta.pilar1Valor, t1Actual, t1Sig);
  const progP2 = progresoTramo(meta.pilar2Valor, t2Actual, t2Sig);

  const com = calcularComisionPorAgente(spec.slug, meta.pilar1Valor, meta.pilar2Valor, config);

  // Proyección a cierre
  const dias = diasTrabajados(snapshot, spec.slug, mes);
  const total = diasTotalesDelMes(mes);
  const v1Proy = dias > 0 ? proyectarFinDeMes(meta.pilar1Valor, dias, total) : meta.pilar1Valor;
  const atenProy = dias > 0 ? proyectarFinDeMes(m.aten, dias, total) : m.aten;
  const numProy = dias > 0 ? proyectarFinDeMes(meta.pilar2Numerador, dias, total) : meta.pilar2Numerador;
  const v2Proy = atenProy > 0 ? +(numProy / atenProy * 100).toFixed(1) : 0;
  const comProy = calcularComisionPorAgente(spec.slug, v1Proy, v2Proy, config).total;

  const faltanP1 = t1Sig ? Math.max(0, t1Sig.min - meta.pilar1Valor) : 0;
  const faltanNum = t2Sig ? solicitudesParaPct(meta.pilar2Numerador, meta.pilar2Denominador, t2Sig.min) : 0;

  return (
    <div className="card-surface p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-display font-bold text-[18px]"
            style={{ background: spec.color }}
          >
            {spec.initials}
          </div>
          <div>
            <div className="font-display text-[18px] font-semibold text-ink leading-tight">{spec.nombre}</div>
            <div className="text-[11px] text-muted2 font-mono mt-0.5">{spec.cupon || '—'}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted2">Comisión proyectada</div>
          <div className="font-display text-[22px] font-semibold tabular text-ink leading-none mt-1">
            {formatSol(comProy)}
          </div>
          <div className="text-[10.5px] text-muted2 mt-0.5">acumulado: {formatSol(com.total)}</div>
        </div>
      </div>

      {/* PILAR 1 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.12em] font-bold" style={{ color: spec.color }}>P1</span>
            <span className="text-[12px] font-semibold text-ink capitalize">{meta.pilar1Plural}</span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-display font-semibold tabular text-ink">{meta.pilar1Valor}</span>
            {t1Sig && <span className="text-muted2 tabular">/ {t1Sig.min}</span>}
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-bold"
              style={{ background: spec.colorSoft, color: spec.color }}
            >
              {t1Actual.mul}×
            </span>
          </div>
        </div>
        <div className="h-2 bg-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full anim-progress-fill transition-[width] duration-700"
            style={{ width: `${Math.max(2, progP1)}%`, background: spec.color }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10.5px]">
          <span className="text-muted2">Cierre proyectado: <strong className="text-ink2 tabular">{v1Proy} {blipOnly ? 'deja-sol' : 'A-E'}</strong></span>
          {t1Sig ? (
            <span className="font-semibold" style={{ color: spec.color }}>
              Faltan {faltanP1} para {t1Sig.mul}×
            </span>
          ) : (
            <span className="font-semibold text-aqua-700">Tramo máximo</span>
          )}
        </div>
      </div>

      {/* PILAR 2 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-gold-600">P2</span>
            <span className="text-[12px] font-semibold text-ink">{blipOnly ? '% Deja / Aten' : '% Sol / Aten'}</span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-display font-semibold tabular text-ink">{meta.pilar2Valor.toFixed(1)}%</span>
            {t2Sig && <span className="text-muted2 tabular">/ {t2Sig.min}%</span>}
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gold-100 text-gold-700">
              {com.pilar2.aplicado === 0 ? 'sin bono' : `+${formatSol(com.pilar2.aplicado)}`}
            </span>
          </div>
        </div>
        <div className="h-2 bg-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full anim-progress-fill transition-[width] duration-700"
            style={{ width: `${Math.max(2, progP2)}%`, background: '#D1A646' }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10.5px]">
          <span className="text-muted2">Cierre proyectado: <strong className="text-ink2 tabular">{v2Proy.toFixed(1)}%</strong></span>
          {t2Sig ? (
            <span className="font-semibold text-gold-700">
              {faltanNum > 0 ? `${faltanNum} ${meta.pilar2NumeradorLabel} más para ${t2Sig.min}%` : `${(t2Sig.min - meta.pilar2Valor).toFixed(1)} pp para subir`}
            </span>
          ) : (
            <span className="font-semibold text-aqua-700">Tramo máximo</span>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-line grid grid-cols-3 gap-3 text-[11px]">
        <div>
          <div className="text-muted2 uppercase tracking-wider text-[9.5px]">Atenciones</div>
          <div className="font-display font-semibold text-[15px] tabular text-ink mt-0.5">{nf(m.aten)}</div>
        </div>
        <div>
          <div className="text-muted2 uppercase tracking-wider text-[9.5px]">{blipOnly ? 'Deja sol.' : 'Solicitudes'}</div>
          <div className="font-display font-semibold text-[15px] tabular text-ink mt-0.5">{nf(blipOnly ? m.deja : m.sol)}</div>
        </div>
        <div>
          <div className="text-muted2 uppercase tracking-wider text-[9.5px]">Días trabajados</div>
          <div className="font-display font-semibold text-[15px] tabular text-ink mt-0.5">{dias}</div>
        </div>
      </div>

      <div className="mt-4">
        <Link
          href={`/agente/${spec.slug}`}
          className="inline-flex items-center gap-1 text-[12px] font-semibold transition-colors"
          style={{ color: spec.color }}
        >
          Ver dashboard completo →
        </Link>
      </div>
    </div>
  );
}

function Tipificaciones({ tags, total }: { tags: { tag: string; n: number }[]; total: number }) {
  const max = Math.max(...tags.map(t => t.n), 1);
  return (
    <div className="space-y-2.5">
      {tags.map(t => (
        <div key={t.tag}>
          <div className="flex items-center justify-between text-[12.5px] mb-1">
            <span className="text-ink2 font-medium">{t.tag}</span>
            <span className="tabular text-muted">
              {nf(t.n)}
              <span className="text-muted2 ml-2">({pct(total > 0 ? t.n / total * 100 : 0, 1)})</span>
            </span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${(t.n / max) * 100}%` }}
              aria-hidden
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TARJETA específica de Luz (esquema todo-o-nada)
// ============================================================
function TarjetaLuz({
  spec, snapshot, mes, config, m,
}: {
  spec: typeof AGENTES.fernanda;
  snapshot: DataSnapshot;
  mes: MesKey;
  config: ComisionConfig;
  m: ReturnType<typeof metricasAgente>;
}) {
  const luz = calcularComisionLuz(m.pctResolucion, config);
  const dias = diasTrabajados(snapshot, spec.slug, mes);
  const total = diasTotalesDelMes(mes);
  const cerProy = dias > 0 ? proyectarFinDeMes(m.cerradas, dias, total) : m.cerradas;
  const noConProy = dias > 0 ? proyectarFinDeMes(m.noContesta, dias, total) : m.noContesta;
  const soluProy = dias > 0 ? proyectarFinDeMes(m.solucionadas, dias, total) : m.solucionadas;
  const conProy = Math.max(0, cerProy - noConProy);
  const pctProy = conProy > 0 ? +(soluProy / conProy * 100).toFixed(1) : 0;
  const luzProy = calcularComisionLuz(pctProy, config);
  const ppFaltantes = +(luz.umbralPct - m.pctResolucion).toFixed(1);

  const progPct = Math.min(100, (m.pctResolucion / luz.umbralPct) * 100);

  return (
    <div className="card-surface p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-display font-bold text-[18px]"
            style={{ background: spec.color }}
          >
            {spec.initials}
          </div>
          <div>
            <div className="font-display text-[18px] font-semibold text-ink leading-tight">{spec.nombre}</div>
            <div className="text-[11px] text-muted2 mt-0.5">Esquema SAE · todo o nada</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted2">Comisión proyectada</div>
          <div className="font-display text-[22px] font-semibold tabular text-ink leading-none mt-1">
            {formatSol(luzProy.total)}
          </div>
          <div className="text-[10.5px] text-muted2 mt-0.5">acumulado: {formatSol(luz.total)}</div>
        </div>
      </div>

      {/* Tasa de resolución vs umbral */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.12em] font-bold" style={{ color: spec.color }}>Meta</span>
            <span className="text-[12px] font-semibold text-ink">Tasa de resolución</span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-display font-semibold tabular text-ink">{m.pctResolucion.toFixed(1)}%</span>
            <span className="text-muted2 tabular">/ {luz.umbralPct}%</span>
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-bold"
              style={{
                background: luz.cumple ? spec.colorSoft : '#FFF7E6',
                color: luz.cumple ? spec.color : '#987933',
              }}
            >
              {luz.cumple ? `cobra ${formatSol(luz.bono)}` : 'sin comisión'}
            </span>
          </div>
        </div>
        <div className="h-2 bg-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full anim-progress-fill transition-[width] duration-700"
            style={{ width: `${Math.max(2, progPct)}%`, background: luz.cumple ? spec.color : '#D1A646' }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10.5px]">
          <span className="text-muted2">Cierre proyectado: <strong className="text-ink2 tabular">{pctProy.toFixed(1)}%</strong></span>
          {luz.cumple ? (
            <span className="font-semibold" style={{ color: spec.color }}>Pasa el umbral</span>
          ) : (
            <span className="font-semibold text-gold-700">Faltan {ppFaltantes} pp</span>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-line grid grid-cols-3 gap-3 text-[11px]">
        <div>
          <div className="text-muted2 uppercase tracking-wider text-[9.5px]">Atenciones</div>
          <div className="font-display font-semibold text-[15px] tabular text-ink mt-0.5">{nf(m.aten)}</div>
        </div>
        <div>
          <div className="text-muted2 uppercase tracking-wider text-[9.5px]">Solucionadas</div>
          <div className="font-display font-semibold text-[15px] tabular text-ink mt-0.5">{nf(m.solucionadas)}</div>
        </div>
        <div>
          <div className="text-muted2 uppercase tracking-wider text-[9.5px]">Días trabajados</div>
          <div className="font-display font-semibold text-[15px] tabular text-ink mt-0.5">{dias}</div>
        </div>
      </div>

      <div className="mt-4">
        <Link
          href={`/agente/${spec.slug}`}
          className="inline-flex items-center gap-1 text-[12px] font-semibold transition-colors"
          style={{ color: spec.color }}
        >
          Ver dashboard completo →
        </Link>
      </div>
    </div>
  );
}
