'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Kpi, KpiCompact } from '@/components/ui/Kpi';
import { ChipGroup, Pill } from '@/components/ui/Chips';
import { MetaProgress } from '@/components/ui/MetaProgress';
import { EsquemaComisiones } from '@/components/ui/EsquemaComisiones';
import { useCountUp } from '@/components/ui/useCountUp';
import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import DonutChart from '@/components/charts/DonutChart';
import { AGENTES } from '@/lib/domain/agentes';
import { MES_LABEL_CORTO, MES_LABEL } from '@/lib/domain/meses';
import {
  calcularComision, calcularVieja, formatSol,
  proximoTramoP1, proximoTramoP2, progresoTramo, tramoP1, tramoP2,
} from '@/lib/domain/comisiones';
import {
  diasTotalesDelMes, diasTrabajados, fechaCorta, mesActual,
  metricasAgente, nf, pct, proyectarFinDeMes, solicitudesParaPct, ultimoDiaConDatos,
} from '@/lib/domain/helpers';
import type { AgenteSlug, ComisionConfig, DataSnapshot, MesKey } from '@/lib/domain/types';

type Seccion = 'resumen' | 'atenciones' | 'solicitudes' | 'canales' | 'horarios';

export default function AgenteView({
  snapshot, config, agenteSlug,
}: { snapshot: DataSnapshot; config: ComisionConfig; agenteSlug: AgenteSlug }) {
  const spec = AGENTES[agenteSlug];
  const ag = snapshot.agentes[agenteSlug]!;
  const mesesDisponibles = snapshot.meta.meses.filter(m => ag.meses[m]);
  const mesPorDefecto = mesActual(snapshot) ?? mesesDisponibles[mesesDisponibles.length - 1];

  const [mesSel, setMesSel] = useState<MesKey>(mesPorDefecto);

  return (
    <div className="space-y-7">
      <div className="anim-fade-in-up">
        <CabeceraAgente
          spec={spec}
          snapshot={snapshot}
          mesSel={mesSel}
          mesActualReal={mesPorDefecto}
          onChangeMes={setMesSel}
          mesesDisponibles={mesesDisponibles}
        />
      </div>

      <div className="anim-fade-in-up anim-stagger-1">
        <SeccionMetas
          snapshot={snapshot} config={config}
          agenteSlug={agenteSlug} mes={mesSel}
          esMesActual={mesSel === mesPorDefecto}
        />
      </div>

      {mesSel === mesPorDefecto && (
        <div className="anim-fade-in-up anim-stagger-2">
          <SeccionHoy snapshot={snapshot} agenteSlug={agenteSlug} mes={mesSel} color={spec.color} />
        </div>
      )}

      <div className="anim-fade-in-up anim-stagger-3">
        <SeccionEsquema
          config={config}
          aeTot={metricasAgente(snapshot, agenteSlug, mesSel).aeTot}
          pctSol={metricasAgente(snapshot, agenteSlug, mesSel).pctSol}
          color={spec.color}
        />
      </div>

      <div className="anim-fade-in-up anim-stagger-4">
        <SeccionDesempeno
          snapshot={snapshot} agenteSlug={agenteSlug} mes={mesSel}
          spec={spec}
        />
      </div>

      <SeccionHistorico
        snapshot={snapshot} agenteSlug={agenteSlug}
        mesesDisponibles={mesesDisponibles} color={spec.color}
        config={config}
      />

      <p className="text-[11px] text-muted2 text-center pt-2">
        Datos generados el {fechaCorta(snapshot.meta.generadoEn)}
        {snapshot.meta.generadoPor ? ` por ${snapshot.meta.generadoPor}` : ''}.
      </p>
    </div>
  );
}

// ============================================================ CABECERA
function CabeceraAgente({
  spec, snapshot, mesSel, mesActualReal, onChangeMes, mesesDisponibles,
}: {
  spec: typeof AGENTES.fernanda;
  snapshot: DataSnapshot;
  mesSel: MesKey;
  mesActualReal: MesKey;
  onChangeMes: (m: MesKey) => void;
  mesesDisponibles: MesKey[];
}) {
  const dias = diasTrabajados(snapshot, spec.slug, mesSel);
  const ultimoDia = ultimoDiaConDatos(snapshot, spec.slug, mesSel);

  return (
    <header className="flex items-end justify-between flex-wrap gap-4">
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-display font-bold text-[22px] shrink-0"
          style={{ background: spec.color }}
        >
          {spec.initials}
        </div>
        <div>
          <p className="eyebrow mb-1">{spec.cupon ? `Cupón ${spec.cupon}` : 'Asesora'}</p>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">
            Hola, {spec.nombre.split(' ')[0]}
          </h1>
          <p className="text-[13px] text-muted mt-1.5">
            {mesSel === mesActualReal ? (
              <>
                <span className="font-semibold text-ink2">{MES_LABEL[mesSel]} 2026</span>
                {' · '}{dias} días trabajados
                {ultimoDia && <> · último registro {ultimoDia}</>}
              </>
            ) : (
              <>
                Reporte histórico de <span className="font-semibold text-ink2">{MES_LABEL[mesSel]} 2026</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="eyebrow">Periodo</span>
        <ChipGroup
          options={mesesDisponibles.map(m => ({
            value: m,
            label: m === mesActualReal ? `${MES_LABEL_CORTO[m]} · actual` : MES_LABEL_CORTO[m],
          }))}
          value={mesSel}
          onChange={onChangeMes}
        />
      </div>
    </header>
  );
}

// ============================================================ HERO METAS
function SeccionMetas({
  snapshot, config, agenteSlug, mes, esMesActual,
}: {
  snapshot: DataSnapshot; config: ComisionConfig;
  agenteSlug: AgenteSlug; mes: MesKey; esMesActual: boolean;
}) {
  const spec = AGENTES[agenteSlug];
  const m = metricasAgente(snapshot, agenteSlug, mes);

  // Tramos actuales y siguientes
  const t1Actual = tramoP1(m.aeTot, config.pilar1);
  const t1Siguiente = proximoTramoP1(m.aeTot, config.pilar1);
  const t2Actual = tramoP2(m.pctSol, config.pilar2);
  const t2Siguiente = proximoTramoP2(m.pctSol, config.pilar2);

  const progresoP1 = progresoTramo(m.aeTot, t1Actual, t1Siguiente);
  const progresoP2 = progresoTramo(m.pctSol, t2Actual, t2Siguiente);

  const comActual = calcularComision(m.aeTot, m.pctSol, config);
  const comProx1 = t1Siguiente
    ? calcularComision(t1Siguiente.min, m.pctSol, config)
    : null;
  const comProx2 = t2Siguiente
    ? calcularComision(m.aeTot, t2Siguiente.min, config)
    : null;

  // Proyección a fin de mes (solo si es el mes actual)
  const proyec = useMemo(() => {
    if (!esMesActual) return null;
    const dias = diasTrabajados(snapshot, agenteSlug, mes);
    const total = diasTotalesDelMes(mes);
    if (dias <= 0) return null;
    const aeProy = proyectarFinDeMes(m.aeTot, dias, total);
    const atenProy = proyectarFinDeMes(m.aten, dias, total);
    const solProy  = proyectarFinDeMes(m.sol, dias, total);
    const pctSolProy = atenProy > 0 ? +(solProy / atenProy * 100).toFixed(1) : 0;
    const comProy = calcularComision(aeProy, pctSolProy, config).total;
    return { dias, total, aeProy, atenProy, solProy, pctSolProy, comProy };
  }, [esMesActual, snapshot, agenteSlug, mes, m, config]);

  // Faltantes
  const faltanAE = t1Siguiente ? t1Siguiente.min - m.aeTot : 0;
  const incrementoP1 = comProx1 ? comProx1.pilar1.aplicado - comActual.pilar1.aplicado : 0;

  // Solicitudes que faltan para llegar al siguiente tramo del Pilar 2
  // (manteniendo las atenciones constantes)
  const solFaltantesP2 = t2Siguiente ? solicitudesParaPct(m.sol, m.aten, t2Siguiente.min) : 0;
  const incrementoP2 = comProx2 ? comProx2.pilar2.aplicado - comActual.pilar2.aplicado : 0;

  return (
    <section>
      <h2 className="font-display text-[18px] font-semibold text-ink mb-4 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: spec.color }} />
        Tus metas {esMesActual ? 'este mes' : `de ${MES_LABEL[mes]}`}
      </h2>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* CARD 1: COMISIÓN PROYECTADA / ACUMULADA */}
        <CardComisionHero
          comActual={comActual}
          proyec={proyec}
          esMesActual={esMesActual}
          configBase={config.baseSol}
          comVieja={calcularVieja(m, config)}
        />

        {/* CARD 2: PILAR 1 — APROBADAS-ENTREGADAS */}
        <MetaProgress
          eyebrow="Pilar 1 · Aprobadas-entregadas del mes"
          valorActual={m.aeTot}
          valorObjetivo={t1Siguiente?.min}
          unidad="A-E"
          tramoActual={{
            label: `${t1Actual.mul}×`,
            recompensa: `${formatSol(comActual.pilar1.aplicado)} este mes`,
          }}
          tramoSiguiente={t1Siguiente ? {
            label: `${t1Siguiente.mul}×`,
            recompensa: comProx1
              ? `Subes a ${formatSol(comProx1.pilar1.aplicado)}`
              : '',
          } : null}
          desafio={t1Siguiente ? {
            titulo: `Te faltan ${faltanAE} aprobadas-entregadas`,
            detalle: `para alcanzar el tramo de ${t1Siguiente.mul}× y ganar ${formatSol(incrementoP1)} más este mes (total Pilar 1: ${formatSol(comProx1!.pilar1.aplicado)}).`,
          } : null}
          progresoPct={progresoP1}
          color={spec.color}
          colorSoft={spec.colorSoft}
          tono="aqua"
          footer={
            esMesActual && proyec ? (
              <>
                Al ritmo actual cerrarías abril con{' '}
                <span className="font-semibold text-ink2 tabular">{proyec.aeProy} aprobadas-entregadas</span>
                {proyec.aeProy >= (t1Siguiente?.min ?? Infinity) && (
                  <span className="text-aqua-700 font-semibold"> · llegarías al siguiente tramo</span>
                )}
              </>
            ) : null
          }
        />

        {/* CARD 3: PILAR 2 — % SOL/ATEN */}
        <MetaProgress
          eyebrow="Pilar 2 · Productividad de canal"
          valorActual={m.pctSol}
          decimales={1}
          valorObjetivo={t2Siguiente?.min}
          unidad="% Sol / Aten"
          tramoActual={{
            label: t2Actual.label,
            recompensa: comActual.pilar2.aplicado === 0
              ? 'Sin bono activo'
              : `Bono actual: ${formatSol(comActual.pilar2.aplicado)}`,
          }}
          tramoSiguiente={t2Siguiente ? {
            label: t2Siguiente.label,
            recompensa: comProx2
              ? `Bono pasaría a +${formatSol(comProx2.pilar2.aplicado)}`
              : '',
          } : null}
          desafio={t2Siguiente ? {
            titulo: solFaltantesP2 > 0
              ? `Necesitas ${solFaltantesP2} solicitud${solFaltantesP2 === 1 ? '' : 'es'} más`
              : `Estás a ${(t2Siguiente.min - m.pctSol).toFixed(1)} pp del próximo tramo`,
            detalle: solFaltantesP2 > 0
              ? `con tus ${nf(m.aten)} atenciones actuales, para llegar al ${t2Siguiente.min}% y desbloquear ${formatSol(incrementoP2)} más de bono${comProx2 && comProx2.pilar2.aplicado > 0 ? ` (bono total: ${formatSol(comProx2.pilar2.aplicado)})` : ''}.`
              : `para sumar ${formatSol(incrementoP2)} adicionales al bono.`,
          } : null}
          progresoPct={progresoP2}
          color="#D1A646"
          colorSoft="#FFF7E6"
          tono="gold"
          footer={
            esMesActual && proyec ? (
              <>
                Proyección al cierre:{' '}
                <span className="font-semibold text-ink2 tabular">{proyec.pctSolProy.toFixed(1)}%</span>
                {' '}({nf(proyec.solProy)} solicitudes / {nf(proyec.atenProy)} atenciones)
              </>
            ) : null
          }
        />
      </div>
    </section>
  );
}

function CardComisionHero({
  comActual, proyec, esMesActual, configBase, comVieja,
}: {
  comActual: ReturnType<typeof calcularComision>;
  proyec: { comProy: number; aeProy: number; pctSolProy: number } | null;
  esMesActual: boolean;
  configBase: number;
  comVieja: number;
}) {
  const valorMostrar = esMesActual && proyec ? proyec.comProy : comActual.total;
  const animado = useCountUp(valorMostrar, 1000, 0);
  const acumulado = useCountUp(comActual.total, 1000, 0);

  return (
    <div
      className="card-surface p-6 text-white relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #151744 0%, #212469 100%)' }}
    >
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-blue-200/80 mb-3">
        {esMesActual ? 'Comisión proyectada · fin de mes' : 'Comisión del mes'}
      </p>
      <div className="font-display text-[40px] font-semibold tabular leading-none mb-2">
        S/ {animado.toLocaleString('es-PE')}
      </div>
      {esMesActual && proyec ? (
        <p className="text-[12px] text-blue-200/80 mb-4">
          Acumulado al día de hoy:{' '}
          <span className="font-semibold text-white tabular">S/ {acumulado.toLocaleString('es-PE')}</span>
        </p>
      ) : (
        <p className="text-[12px] text-blue-200/80 mb-4">
          Esquema antiguo de referencia: {formatSol(comVieja)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-blue-300/20 bg-white/5 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-blue-200/80">Pilar 1</div>
          <div className="font-display text-[18px] font-semibold tabular mt-1">
            {formatSol(comActual.pilar1.aplicado)}
          </div>
          <div className="text-[10px] text-blue-200/70 mt-0.5">
            {comActual.pilar1.tramo.mul}× sobre {formatSol(configBase)}
          </div>
        </div>
        <div className="rounded-lg border border-blue-300/20 bg-white/5 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-blue-200/80">Pilar 2</div>
          <div className="font-display text-[18px] font-semibold tabular mt-1">
            {formatSol(comActual.pilar2.aplicado)}
          </div>
          <div className="text-[10px] text-blue-200/70 mt-0.5">{comActual.pilar2.tramo.label}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================ HOY
function SeccionHoy({
  snapshot, agenteSlug, mes, color,
}: { snapshot: DataSnapshot; agenteSlug: AgenteSlug; mes: MesKey; color: string }) {
  const ag = snapshot.agentes[agenteSlug]!;
  const dia = ag.diario[mes] ?? [];
  if (dia.length === 0) return null;

  const ultimoIdx = [...dia].reverse().findIndex(d => d.aten > 0 || d.ae > 0 || d.deja > 0);
  if (ultimoIdx === -1) return null;
  const idxReal = dia.length - 1 - ultimoIdx;
  const hoy = dia[idxReal];
  const ayer = idxReal > 0 ? dia[idxReal - 1] : null;

  const delta = (cur: number, prev: number | null): { value: number; positiveIsGood: boolean } | undefined => {
    if (prev == null || prev === 0) return undefined;
    return { value: +(((cur - prev) / prev) * 100).toFixed(1), positiveIsGood: true };
  };

  const cumAten = dia.slice(0, idxReal + 1).reduce((a, d) => a + d.aten, 0);
  const cumAE   = dia.slice(0, idxReal + 1).reduce((a, d) => a + d.ae, 0);
  const cumDeja = dia.slice(0, idxReal + 1).reduce((a, d) => a + d.deja, 0);

  return (
    <section>
      <h2 className="font-display text-[18px] font-semibold text-ink mb-4 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: color }} />
        Tu jornada más reciente <span className="text-muted2 text-[14px] font-normal">· {hoy.day}</span>
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Atenciones del día"
          value={nf(hoy.aten)}
          accent={color}
          delta={delta(hoy.aten, ayer?.aten ?? null)}
          hint={`Acumulado del mes: ${nf(cumAten)}`}
        />
        <Kpi
          label="Deja solicitud"
          value={nf(hoy.deja)}
          accent="#4453A0"
          delta={delta(hoy.deja, ayer?.deja ?? null)}
          hint={`Acumulado del mes: ${nf(cumDeja)}`}
        />
        <Kpi
          label="Aprobadas-entregadas hoy"
          value={nf(hoy.ae)}
          accent="#D1A646"
          delta={delta(hoy.ae, ayer?.ae ?? null)}
          hint={`Acumulado del mes: ${nf(cumAE)}`}
        />
        <Kpi
          label="Conversión del día"
          value={hoy.aten > 0 ? `${(hoy.deja / hoy.aten * 100).toFixed(1)}%` : '—'}
          accent="#00A29B"
          hint="Cuántas conversaciones piden financiamiento"
        />
      </div>
    </section>
  );
}

// ============================================================ ESQUEMA
function SeccionEsquema({
  config, aeTot, pctSol, color,
}: {
  config: ComisionConfig; aeTot: number; pctSol: number; color: string;
}) {
  return (
    <section>
      <h2 className="font-display text-[18px] font-semibold text-ink mb-4 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: color }} />
        Tu esquema de comisiones
      </h2>
      <EsquemaComisiones config={config} aeTot={aeTot} pctSol={pctSol} agenteColor={color} />
    </section>
  );
}

// ============================================================ DESEMPEÑO
function SeccionDesempeno({
  snapshot, agenteSlug, mes, spec,
}: {
  snapshot: DataSnapshot; agenteSlug: AgenteSlug; mes: MesKey;
  spec: typeof AGENTES.fernanda;
}) {
  const m = metricasAgente(snapshot, agenteSlug, mes);
  const ag = snapshot.agentes[agenteSlug]!;
  const dia = ag.diario[mes] ?? [];

  const [seccion, setSeccion] = useState<Seccion>('resumen');

  return (
    <section>
      <h2 className="font-display text-[18px] font-semibold text-ink mb-4 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: spec.color }} />
        Tu desempeño en {MES_LABEL[mes]}
      </h2>

      <div className="mb-5">
        <ChipGroup
          options={[
            { value: 'resumen',     label: 'Resumen' },
            { value: 'atenciones',  label: 'Atenciones' },
            { value: 'solicitudes', label: 'Solicitudes y A-E' },
            { value: 'canales',     label: 'Canales' },
            { value: 'horarios',    label: 'Horarios' },
          ]}
          value={seccion}
          onChange={setSeccion}
        />
      </div>

      {seccion === 'resumen' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Atenciones del mes" value={nf(m.aten)} accent="#4453A0" size="lg" hint="Conversaciones cerradas en Blip" />
          <Kpi label="Deja solicitud" value={nf(m.deja)} accent="#6873D7" size="lg" hint={`${pct(m.pctDeja, 1)} de las atenciones`} />
          <Kpi label="Solicitudes" value={nf(m.sol)} accent="#00A29B" size="lg" hint="Atribuidas por tu cupón" />
          <Kpi label="Aprobadas-entregadas" value={nf(m.aeTot)} accent="#D1A646" size="lg" hint={`Cupón ${nf(m.aeCup)} · Preowner ${nf(m.aePre)}`} />
        </div>
      )}

      {seccion === 'atenciones' && (
        <Card>
          <CardHeader
            eyebrow="Volumen diario"
            title="Atenciones día a día"
            subtitle="Cómo se distribuye la carga en el mes"
            right={
              <div className="flex gap-3 text-[12px]">
                <span className="text-muted">Total <strong className="text-ink tabular ml-1">{nf(m.aten)}</strong></span>
                <span className="text-muted">Promedio <strong className="text-ink tabular ml-1">{dia.length > 0 ? nf(m.aten / Math.max(1, dia.filter(d => d.aten > 0).length), 1) : '—'}</strong></span>
              </div>
            }
          />
          <LineChart
            labels={dia.map(d => d.day)}
            series={[
              { label: 'Atenciones', data: dia.map(d => d.aten), color: spec.color, fill: true },
              { label: 'Deja sol.',  data: dia.map(d => d.deja), color: '#98A9DF' },
            ]}
            height={280}
            legend
          />
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-line">
            <KpiCompact label="Cola promedio" value={nf(m.qtAvg, 1)} unit="min" accent="#36B7B3" />
            <KpiCompact label="1ª respuesta" value={nf(m.frtAvg, 2)} unit="min" accent="#00A29B" />
            <KpiCompact label="Resp. entre msgs" value={nf(m.artAvg, 1)} unit="min" accent="#007974" />
          </div>
        </Card>
      )}

      {seccion === 'solicitudes' && (
        <Card>
          <CardHeader
            eyebrow="Pipeline diario"
            title="Solicitudes y aprobadas-entregadas"
            subtitle="Cuántas solicitudes ingresaste y cuántas terminaron en A-E"
            right={
              <div className="flex gap-3 text-[12px]">
                <span className="text-muted">Sol <strong className="text-ink tabular ml-1">{nf(m.sol)}</strong></span>
                <span className="text-muted">A-E <strong className="text-ink tabular ml-1">{nf(m.aeTot)}</strong></span>
                <span className="text-muted">Tasa <strong className="text-ink tabular ml-1">{m.sol > 0 ? pct(m.aeTot / m.sol * 100) : '—'}</strong></span>
              </div>
            }
          />
          <LineChart
            labels={dia.map(d => d.day)}
            series={[
              { label: 'Aprobadas-entregadas', data: dia.map(d => d.ae), color: '#D1A646', fill: true },
            ]}
            height={280}
            legend={false}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-line">
            <KpiCompact label="A-E Cupón" value={nf(m.aeCup)} accent="#36B7B3" />
            <KpiCompact label="A-E Preowner" value={nf(m.aePre)} accent="#5CBFBE" />
            <KpiCompact label="% Sol/Aten" value={pct(m.pctSol, 1)} accent="#212469" />
            <KpiCompact label="A-E / Sol" value={m.sol > 0 ? pct(m.aeTot / m.sol * 100) : '—'} accent="#151744" />
          </div>
        </Card>
      )}

      {seccion === 'canales' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader eyebrow="Distribución" title="Atenciones por canal" subtitle="WhatsApp · Facebook · otros" />
            <DonutChart
              labels={['WhatsApp', 'Facebook', 'Otro']}
              values={[m.canales.whatsapp, m.canales.facebook, m.canales.otro]}
              colors={['#00A29B', '#4453A0', '#D1A646']}
              centerLabel="Total"
              centerValue={nf(m.aten)}
              height={260}
            />
          </Card>
          <Card>
            <CardHeader eyebrow="Cierres" title="Top tipificaciones" subtitle="Cómo cierran las conversaciones que atiendes" />
            {m.tags.length === 0 ? (
              <p className="text-[13px] text-muted">Sin tipificaciones registradas en el mes.</p>
            ) : (
              <div className="space-y-2.5">
                {m.tags.slice(0, 7).map(t => {
                  const max = Math.max(...m.tags.map(x => x.n), 1);
                  return (
                    <div key={t.tag}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="text-ink2 font-medium truncate pr-2">{t.tag}</span>
                        <span className="tabular text-muted">
                          {nf(t.n)}
                          <span className="text-muted2 ml-1.5">({m.aten > 0 ? pct(t.n / m.aten * 100, 1) : '0%'})</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(t.n / max) * 100}%`, background: spec.color }} aria-hidden />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {seccion === 'horarios' && (
        <SeccionHorarios ag={ag} color={spec.color} />
      )}
    </section>
  );
}

function SeccionHorarios({ ag, color }: { ag: { horario?: { hora: number[] } }; color: string }) {
  const horario = ag.horario?.hora ?? new Array(24).fill(0);
  const totalH = horario.reduce((a, b) => a + b, 0);
  const horaPico = horario.indexOf(Math.max(...horario, 0));
  const turnos = [
    { label: 'Mañana 6h–12h', range: [6, 12] as const },
    { label: 'Tarde 12h–18h', range: [12, 18] as const },
    { label: 'Noche 18h–24h', range: [18, 24] as const },
    { label: 'Madrugada 0h–6h', range: [0, 6] as const },
  ];
  return (
    <Card>
      <CardHeader
        eyebrow="Distribución horaria"
        title="¿En qué horas atiendes más?"
        subtitle={totalH > 0 ? `Hora pico: ${String(horaPico).padStart(2, '0')}:00` : 'Sin datos suficientes'}
      />
      <BarChart
        labels={Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))}
        series={[{ label: 'Chats', data: horario, color }]}
        height={260}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-line">
        {turnos.map(t => {
          const total = horario.slice(t.range[0], t.range[1]).reduce((a, b) => a + b, 0);
          const pctv = totalH > 0 ? (total / totalH) * 100 : 0;
          return (
            <div key={t.label} className="bg-bg/60 border border-line rounded-xl p-4">
              <p className="eyebrow text-[9.5px] mb-1.5">{t.label}</p>
              <div className="font-display text-[20px] font-semibold tabular text-ink">{nf(total)}</div>
              <div className="text-[11px] text-muted2 mt-0.5">{pctv.toFixed(1)}% del total</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================================ HISTÓRICO
function SeccionHistorico({
  snapshot, agenteSlug, mesesDisponibles, color, config,
}: {
  snapshot: DataSnapshot; agenteSlug: AgenteSlug;
  mesesDisponibles: MesKey[]; color: string; config: ComisionConfig;
}) {
  if (mesesDisponibles.length < 2) return null;

  const filas = mesesDisponibles.map(m => {
    const met = snapshot.agentes[agenteSlug]!.meses[m]!;
    const com = calcularComision(met.aeTot, met.pctSol, config).total;
    return { mes: m, met, com };
  });

  return (
    <section>
      <h2 className="font-display text-[18px] font-semibold text-ink mb-4 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full" style={{ background: color }} />
        Tu histórico mes a mes
      </h2>
      <Card padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">Mes</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Atenciones</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Solicitudes</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">% Sol</th>
                <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Aprob-Entreg</th>
                <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filas.map(f => (
                <tr key={f.mes} className="hover:bg-bg/60">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-7 rounded-full" style={{ background: color }} />
                      <span className="font-semibold text-ink">{MES_LABEL[f.mes]} 2026</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular">{nf(f.met.aten)}</td>
                  <td className="px-3 py-3 text-right tabular">{nf(f.met.sol)}</td>
                  <td className="px-3 py-3 text-right tabular text-muted">{pct(f.met.pctSol, 1)}</td>
                  <td className="px-3 py-3 text-right tabular">{nf(f.met.aeTot)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className="font-display font-semibold text-ink tabular">{formatSol(f.com)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
