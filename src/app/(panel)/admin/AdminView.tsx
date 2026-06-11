'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Chips';
import {
  fechaCorta, nf, TAGS_SOLUCIONADAS_DEFAULT, TAGS_NO_CONTESTA_DEFAULT,
} from '@/lib/domain/helpers';
import { buildSnapshot } from '@/lib/parser';
import { normalizar } from '@/lib/parser/blip';
import { AGENTES } from '@/lib/domain/agentes';
import { upload } from '@vercel/blob/client';
import { ESQUEMAS_HISTORICOS } from '@/lib/domain/esquemas-historicos';
import { MES_LABEL, ordenarMeses } from '@/lib/domain/meses';
import { formatSol } from '@/lib/domain/comisiones';
import type { ComisionConfig, DataSnapshot, MesKey, SnapshotMeta, TramoP1, TramoP2 } from '@/lib/domain/types';

interface UserPub { username: 'admin' | 'jefa' | 'fernanda' | 'stefania' | 'julio' | 'luz'; rol: string; display: string }

export type AdminVista = 'carga' | 'comisiones' | 'comisiones-luz' | 'sae-tags' | 'usuarios';

const TITULOS: Record<AdminVista, { eyebrow: string; title: string; subtitle: string }> = {
  'carga': {
    eyebrow: 'Carga de datos',
    title: 'Actualización diaria',
    subtitle: 'Sube el CSV de Blip y el XLSX de Admin para refrescar los reportes del equipo.',
  },
  'comisiones': {
    eyebrow: 'Esquema general · vigente mayo 2026',
    title: 'Tramos para Fernanda, Stefania y Julio',
    subtitle: 'Comisión base y tramos del Pilar 1 (% Sol/Cerradas × multiplicador, con piso de atenciones como guardrail) y Pilar 2 (AE del mes → bono fijo). Transferidas excluidas del denominador.',
  },
  'comisiones-luz': {
    eyebrow: 'Esquema SAE',
    title: 'Comisión de Luz',
    subtitle: 'Esquema todo-o-nada: si su tasa de resolución alcanza el umbral, comisiona el bono fijo.',
  },
  'sae-tags': {
    eyebrow: 'Universo SAE',
    title: 'Tipificaciones que cuentan',
    subtitle: 'Marca qué tipificaciones de Luz suman como "solucionada" y cuáles restan del denominador "contestadas". Los cambios se aplican al instante.',
  },
  'usuarios': {
    eyebrow: 'Cuentas',
    title: 'Gestión de usuarios',
    subtitle: 'Cambia el nombre que se muestra en la plataforma o restablece contraseñas de cualquier usuario.',
  },
};

export default function AdminView({
  snapshotMeta, snapshot, config, users, vista = 'carga',
}: {
  snapshotMeta: SnapshotMeta | null;
  snapshot: DataSnapshot | null;
  config: ComisionConfig;
  users: UserPub[];
  vista?: AdminVista;
}) {
  const t = TITULOS[vista];
  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow mb-2">{t.eyebrow}</p>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">
          {t.title}
        </h1>
        <p className="text-[13.5px] text-muted mt-2 max-w-3xl">{t.subtitle}</p>
      </header>

      {vista === 'carga'         && <UploadCard meta={snapshotMeta} />}
      {vista === 'comisiones'    && (
        <div className="space-y-7">
          <ConfigCard config={config} />
          <EsquemasHistoricosCard kind="ventas" vigente={config} />
        </div>
      )}
      {vista === 'comisiones-luz'&& (
        <div className="space-y-7">
          <ConfigLuzCard config={config} />
          <EsquemasHistoricosCard kind="luz" vigente={config} />
        </div>
      )}
      {vista === 'sae-tags'      && <SaeTagsCard config={config} snapshot={snapshot} />}
      {vista === 'usuarios'      && <UsersCard usuarios={users} />}
    </div>
  );
}

// ============================================================ UPLOAD
function UploadCard({ meta }: { meta: SnapshotMeta | null }) {
  const router = useRouter();
  const [csv, setCsv]  = useState<File | null>(null);
  const [xlsx, setXlsx] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Mes del Excel a descargar: 'all' (todos) o un mes concreto del snapshot.
  const [exportMes, setExportMes] = useState<string>('all');

  async function submit() {
    if (!csv || !xlsx) return;
    setLoading(true); setError(null); setResult(null);
    const t0 = performance.now();
    try {
      // 1. Procesar archivos en el browser (evita el límite de 4.5 MB de Vercel)
      const [csvText, xlsxBuffer] = await Promise.all([
        csv.text(),
        xlsx.arrayBuffer(),
      ]);
      const report = await buildSnapshot({
        csvBuffer: csvText,
        xlsxBuffer,
        archivoBlip: csv.name,
        archivoAdmin: xlsx.name,
      });
      const procMs = Math.round(performance.now() - t0);

      // 2. Subir los archivos crudos al Blob (best-effort, no bloquea el
      //    flujo si falla — son solo para el botón "Descargar Excel").
      //    Se usa direct-upload para evitar el límite de 4.5 MB de las API routes.
      const originalesErrs: string[] = [];
      await Promise.allSettled([
        upload('originales/blip-latest.csv', csv, {
          access: 'public',
          handleUploadUrl: '/api/upload-original',
          contentType: 'text/csv',
        }).catch(e => { originalesErrs.push(`Blip crudo: ${e?.message ?? e}`); }),
        upload('originales/admin-latest.xlsx', xlsx, {
          access: 'public',
          handleUploadUrl: '/api/upload-original',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }).catch(e => { originalesErrs.push(`Admin crudo: ${e?.message ?? e}`); }),
      ]);

      // 3. Enviar el snapshot procesado (≈13 KB) al server para persistirlo
      const r = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: report.snapshot }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Error al guardar el snapshot.');
      } else {
        setResult({
          ok: true,
          tomaMs: procMs,
          meta: data.meta,
          merge: data.merge,
          blip: report.blip,
          admin: report.admin,
          warnings: [...report.warnings, ...originalesErrs],
        });
        router.refresh();
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo procesar los archivos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Carga diaria"
        title="Actualización de datos"
        subtitle="Sube el CSV de Blip (AgentHistory) y el XLSX de Admin (reporte_solicitudes). Las cargas se acumulan: meses ya cargados que no aparezcan en el archivo nuevo se preservan."
        right={meta ? <Pill tone="aqua">Cargado · {fechaCorta(meta.generadoEn)}</Pill> : <Pill tone="gold">Sin datos</Pill>}
      />
      {meta && (
        <div className="bg-bg/60 border border-line rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12px]">
          <div>
            <p className="eyebrow text-[9.5px] mb-1">Atenciones</p>
            <span className="font-display text-[18px] font-semibold tabular text-ink">{nf(meta.totales.atenciones)}</span>
          </div>
          <div>
            <p className="eyebrow text-[9.5px] mb-1">Solicitudes</p>
            <span className="font-display text-[18px] font-semibold tabular text-ink">{nf(meta.totales.solicitudes)}</span>
          </div>
          <div>
            <p className="eyebrow text-[9.5px] mb-1">AE Totales</p>
            <span className="font-display text-[18px] font-semibold tabular text-ink">{nf(meta.totales.ae)}</span>
          </div>
          <div>
            <p className="eyebrow text-[9.5px] mb-1">Meses</p>
            <span className="font-display text-[14px] font-semibold tabular text-ink">{meta.meses.join(' · ').toUpperCase()}</span>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <FileDrop
          label="CSV de Blip — AgentHistory_*.csv"
          help={meta?.archivoBlip ?? 'Archivo descargado del panel Blip · separador ;'}
          accept=".csv,text/csv"
          file={csv}
          onChange={setCsv}
          tone="blue"
        />
        <FileDrop
          label="XLSX de Admin — reporte_solicitudes.xlsx"
          help={meta?.archivoAdmin ?? 'Archivo descargado del sistema interno'}
          accept=".xlsx"
          file={xlsx}
          onChange={setXlsx}
          tone="aqua"
        />
      </div>

      {error && (
        <div className="mt-4 text-[13px] text-gold-700 bg-gold-100 border border-gold-300 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 text-[13px] text-aqua-700 bg-aqua-100 border border-aqua-300 rounded-lg px-4 py-3 space-y-1">
          <div className="font-semibold">Procesamiento exitoso · {result.tomaMs} ms</div>
          <div className="text-aqua-800/80">
            Blip: {nf(result.blip.filasLeidas)} filas leídas · Admin: {nf(result.admin.filasLeidas)} filas leídas.
          </div>
          {result.merge && (
            <div className="mt-2 pt-2 border-t border-aqua-300/40 text-[12px] space-y-1">
              <div className="font-semibold text-aqua-800">Resultado del merge con datos previos:</div>
              {result.merge.mesesNuevos?.length > 0 && (
                <div>
                  <span className="text-aqua-700/70">Meses nuevos: </span>
                  <span className="font-semibold uppercase">{result.merge.mesesNuevos.join(' · ')}</span>
                </div>
              )}
              {result.merge.mesesReemplazados?.length > 0 && (
                <div>
                  <span className="text-aqua-700/70">Meses actualizados: </span>
                  <span className="font-semibold uppercase">{result.merge.mesesReemplazados.join(' · ')}</span>
                </div>
              )}
              {result.merge.mesesPreservados?.length > 0 && (
                <div>
                  <span className="text-aqua-700/70">Meses históricos preservados: </span>
                  <span className="font-semibold uppercase">{result.merge.mesesPreservados.join(' · ')}</span>
                </div>
              )}
            </div>
          )}
          {Array.isArray(result.warnings) && result.warnings.length > 0 && (
            <ul className="text-gold-700 list-disc pl-5 mt-1.5">
              {result.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <select
            value={exportMes}
            onChange={e => setExportMes(e.target.value)}
            className="input-field text-[12.5px] py-1.5 max-w-[160px]"
            title="Mes a exportar"
          >
            <option value="all">Todos los meses</option>
            {meta?.meses.map(m => (
              <option key={m} value={m}>{m.toUpperCase()}</option>
            ))}
          </select>
          <a
            href={exportMes === 'all' ? '/api/export' : `/api/export?mes=${exportMes}`}
            download
            className="text-[13px] font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4 decoration-blue-300 hover:decoration-blue-700"
            title={
              exportMes === 'all'
                ? 'Descarga un Excel con todos los meses (resumen, tipificaciones, AE diarias y detalle gestión por gestión).'
                : `Descarga un Excel solo de ${exportMes.toUpperCase()}: comisión del mes, tipificaciones, solicitudes con IDs y detalle gestión por gestión.`
            }
          >
            ↓ Descargar Excel
          </a>
        </div>
        <button
          type="button"
          disabled={!csv || !xlsx || loading}
          className="btn-primary"
          onClick={submit}
        >
          {loading ? 'Procesando…' : 'Procesar y publicar'}
        </button>
      </div>
    </Card>
  );
}

function FileDrop({
  label, help, accept, file, onChange, tone,
}: {
  label: string; help: string; accept: string; file: File | null;
  onChange: (f: File | null) => void; tone: 'blue' | 'aqua';
}) {
  const accent = tone === 'blue' ? '#4453A0' : '#00A29B';
  const accentSoft = tone === 'blue' ? '#D6DCED' : '#E0F1F3';
  return (
    <label
      className="flex flex-col gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors"
      style={{ borderColor: file ? accent : '#E4E7F2', background: file ? accentSoft + '40' : 'white' }}
    >
      <span className="eyebrow">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-white text-[13px] shrink-0"
          style={{ background: accent }}
        >
          {tone === 'blue' ? 'B' : 'A'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] text-ink truncate">
            {file ? file.name : 'Selecciona o arrastra un archivo'}
          </div>
          <div className="text-[11.5px] text-muted truncate">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : help}
          </div>
        </div>
        {file && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); onChange(null); }}
            className="text-[11.5px] text-muted hover:text-gold-700"
          >
            Quitar
          </button>
        )}
      </div>
      <input
        type="file"
        accept={accept}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
    </label>
  );
}

// ============================================================ CONFIG
function ConfigCard({ config: initial }: { config: ComisionConfig }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<ComisionConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? 'Error al guardar.'); return; }
      setSavedAt(Date.now());
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo contactar al servidor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Esquema de comisiones"
        title="Tramos y base mensual"
        subtitle="Cambios afectan a todas las vistas: Resumen, Por agente, Metas y Comparativo"
      />
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-bg/60 border border-line rounded-xl p-4">
          <p className="eyebrow mb-2">Base mensual (S/)</p>
          <input
            type="number" min={0} step={50}
            value={cfg.baseSol}
            onChange={e => setCfg({ ...cfg, baseSol: Number(e.target.value || 0) })}
            className="input-field font-display text-[20px] font-semibold tabular"
          />
        </div>
        <div className="bg-bg/60 border border-line rounded-xl p-4">
          <p className="eyebrow mb-2">Comisión vieja — Cupón (S/)</p>
          <input
            type="number" min={0} step={1}
            value={cfg.viejaCupon}
            onChange={e => setCfg({ ...cfg, viejaCupon: Number(e.target.value || 0) })}
            className="input-field font-display text-[20px] font-semibold tabular"
          />
        </div>
        <div className="bg-bg/60 border border-line rounded-xl p-4">
          <p className="eyebrow mb-2">Comisión vieja — Preowner (S/)</p>
          <input
            type="number" min={0} step={1}
            value={cfg.viejaPreowner}
            onChange={e => setCfg({ ...cfg, viejaPreowner: Number(e.target.value || 0) })}
            className="input-field font-display text-[20px] font-semibold tabular"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <p className="eyebrow mb-2">Pilar 1 — % Sol / Cerradas × multiplicador</p>
          <p className="text-[11px] text-muted2 mb-3">
            Columnas: <strong>% mín</strong> · <strong>multiplicador</strong> · <strong>piso atenciones</strong> (guardrail, opcional) · <strong>etiqueta</strong>
          </p>
          {cfg.pilar1.map((t, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 mb-2">
              <input
                type="number" min={0} step={0.5}
                value={t.min}
                onChange={e => {
                  const next = [...cfg.pilar1]; next[i] = { ...t, min: Number(e.target.value || 0) };
                  setCfg({ ...cfg, pilar1: next });
                }}
                placeholder="% mín"
                className="input-field font-mono"
              />
              <input
                type="number" min={0} step={0.05}
                value={t.mul}
                onChange={e => {
                  const next = [...cfg.pilar1]; next[i] = { ...t, mul: Number(e.target.value || 0) };
                  setCfg({ ...cfg, pilar1: next });
                }}
                placeholder="× multipl."
                className="input-field font-mono"
              />
              <input
                type="number" min={0} step={100}
                value={t.pisoAten ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  const next = [...cfg.pilar1];
                  next[i] = { ...t, pisoAten: v === '' ? undefined : Number(v) };
                  setCfg({ ...cfg, pilar1: next });
                }}
                placeholder="piso aten."
                className="input-field font-mono"
              />
              <input
                type="text"
                value={t.label}
                onChange={e => {
                  const next = [...cfg.pilar1]; next[i] = { ...t, label: e.target.value };
                  setCfg({ ...cfg, pilar1: next });
                }}
                placeholder="Etiqueta"
                className="input-field"
              />
            </div>
          ))}
        </div>
        <div>
          <p className="eyebrow mb-2">Pilar 2 — AE del mes → bono fijo</p>
          <p className="text-[11px] text-muted2 mb-3">
            Columnas: <strong>AE mín</strong> · <strong>bono S/</strong> · <strong>etiqueta</strong>
          </p>
          {cfg.pilar2.map((t, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2">
              <input
                type="number" min={0} step={1}
                value={t.min}
                onChange={e => {
                  const next = [...cfg.pilar2]; next[i] = { ...t, min: Number(e.target.value || 0) };
                  setCfg({ ...cfg, pilar2: next });
                }}
                placeholder="AE mín"
                className="input-field font-mono"
              />
              <input
                type="number" min={0} step={50}
                value={t.bono}
                onChange={e => {
                  const next = [...cfg.pilar2]; next[i] = { ...t, bono: Number(e.target.value || 0) };
                  setCfg({ ...cfg, pilar2: next });
                }}
                placeholder="S/"
                className="input-field font-mono"
              />
              <input
                type="text"
                value={t.label}
                onChange={e => {
                  const next = [...cfg.pilar2]; next[i] = { ...t, label: e.target.value };
                  setCfg({ ...cfg, pilar2: next });
                }}
                placeholder="Etiqueta"
                className="input-field"
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 text-[13px] text-gold-700 bg-gold-100 border border-gold-300 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-3">
        {savedAt && (
          <span className="text-[12px] text-aqua-700">Configuración guardada</span>
        )}
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </Card>
  );
}

// ============================================================ CONFIG LUZ
function ConfigLuzCard({ config: initial }: { config: ComisionConfig }) {
  const router = useRouter();
  // Tramos escalonados (esquema desde junio 2026). Si el config persistido
  // todavía está en el shape viejo (umbralPct+bono), lo migramos a un solo
  // tramo equivalente para no perder la configuración del admin.
  const [tramos, setTramos] = useState<Array<{ min: number; bono: number; label: string }>>(() => {
    const t = initial.luzEsquema?.tramos;
    if (Array.isArray(t) && t.length > 0) return t.map(x => ({ ...x }));
    const u = initial.luzEsquema?.umbralPct ?? 60;
    const b = initial.luzEsquema?.bono ?? 300;
    return [{ min: u, bono: b, label: `${u}% o más · S/${b}` }];
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function actualizar(idx: number, campo: 'min' | 'bono' | 'label', valor: string) {
    setTramos(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      if (campo === 'label') return { ...t, label: valor };
      const n = Number(valor || 0);
      return { ...t, [campo]: n };
    }));
  }
  function agregarTramo() {
    setTramos(prev => {
      const ultimo = prev[prev.length - 1];
      const next = { min: (ultimo?.min ?? 60) + 10, bono: (ultimo?.bono ?? 300) + 50, label: '' };
      return [...prev, { ...next, label: `${next.min}% o más · S/${next.bono}` }];
    });
  }
  function quitarTramo(idx: number) {
    setTramos(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      // Orden ascendente por min para que el cálculo aplique bien
      const tramosOrd = [...tramos].sort((a, b) => a.min - b.min);
      const next: ComisionConfig = {
        ...initial,
        luzEsquema: { tramos: tramosOrd },
      };
      const r = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: next }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? 'Error al guardar.'); return; }
      setSavedAt(Date.now());
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo contactar al servidor.');
    } finally {
      setSaving(false);
    }
  }

  const tramosOrd = [...tramos].sort((a, b) => a.min - b.min);
  const umbralMin = tramosOrd[0]?.min ?? 0;

  return (
    <Card>
      <CardHeader
        eyebrow="Esquema SAE · escalonado"
        title="Comisión de Luz"
        subtitle="Cada tramo aplica cuando la tasa de resolución llega a su umbral mínimo. Se cobra el bono del tramo más alto alcanzado."
      />

      <div className="bg-aqua-100 border border-aqua-300 rounded-xl p-4 mb-5 text-[12.5px] text-aqua-700 leading-relaxed">
        <strong>Cómo se mide:</strong> tasa de resolución = consultas solucionadas (universo unificado de tipificaciones SAE) ÷ contestadas (cerradas que no son "no contesta") × 100.
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 text-[11px] uppercase tracking-wider text-muted px-1">
          <span>Umbral mínimo (%)</span>
          <span>Bono (S/)</span>
          <span>Etiqueta visible</span>
          <span></span>
        </div>
        {tramos.map((t, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center bg-bg/60 border border-line rounded-xl p-3">
            <input
              type="number" min={0} max={100} step={0.5}
              value={t.min}
              onChange={e => actualizar(idx, 'min', e.target.value)}
              className="input-field font-display text-[18px] font-semibold tabular"
            />
            <input
              type="number" min={0} step={50}
              value={t.bono}
              onChange={e => actualizar(idx, 'bono', e.target.value)}
              className="input-field font-display text-[18px] font-semibold tabular"
            />
            <input
              type="text"
              value={t.label}
              onChange={e => actualizar(idx, 'label', e.target.value)}
              className="input-field text-[13px]"
              placeholder="Ej. 60% – 79% · S/300"
            />
            <button
              type="button"
              onClick={() => quitarTramo(idx)}
              disabled={tramos.length <= 1}
              className="text-[12px] text-muted hover:text-gold-700 disabled:opacity-30 px-2"
              title="Quitar tramo"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={agregarTramo}
          className="text-[12.5px] text-blue-700 hover:text-blue-900 font-semibold underline underline-offset-4 decoration-blue-300"
        >
          + Agregar tramo
        </button>
      </div>

      <div className="mt-6 rounded-xl border-2 border-dashed border-line p-5 bg-bg/30">
        <p className="eyebrow mb-2">Vista previa</p>
        <ul className="text-[13.5px] text-ink2 leading-relaxed space-y-1.5">
          <li><strong className="text-ink tabular">{`< ${umbralMin}%`}</strong> → no comisiona</li>
          {tramosOrd.map((t, i) => (
            <li key={i}>
              <strong className="text-ink tabular">{`≥ ${t.min}%`}</strong>
              {' → cobra '}
              <strong className="text-ink tabular">{`S/ ${t.bono.toLocaleString('es-PE')}`}</strong>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="mt-4 text-[13px] text-gold-700 bg-gold-100 border border-gold-300 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-3">
        {savedAt && (
          <span className="text-[12px] text-aqua-700">Configuración guardada</span>
        )}
        <button onClick={save} disabled={saving || tramos.length === 0} className="btn-primary">
          {saving ? 'Guardando…' : 'Guardar regla de Luz'}
        </button>
      </div>
    </Card>
  );
}

// ============================================================ SAE TAGS
function SaeTagsCard({
  config: initial, snapshot,
}: { config: ComisionConfig; snapshot: DataSnapshot | null }) {
  const router = useRouter();

  // Reúne todas las tipificaciones únicas de Luz a través de los meses
  // disponibles, con su conteo total. Si Luz aún no tiene datos, lista vacía.
  const tipificacionesLuz: Array<{ tag: string; n: number; norm: string }> = (() => {
    if (!snapshot) return [];
    const ag = snapshot.agentes.luz;
    if (!ag) return [];
    const acc = new Map<string, { tag: string; n: number }>();
    for (const m of Object.values(ag.meses)) {
      if (!m) continue;
      for (const t of m.tags) {
        const norm = normalizar(t.tag);
        const prev = acc.get(norm);
        if (prev) {
          prev.n += t.n;
        } else {
          acc.set(norm, { tag: t.tag, n: t.n });
        }
      }
    }
    const arr: Array<{ tag: string; n: number; norm: string }> = [];
    for (const [norm, v] of acc.entries()) {
      arr.push({ tag: v.tag, n: v.n, norm });
    }
    arr.sort((a, b) => b.n - a.n);
    return arr;
  })();

  // Set "solucionadas" actuales (con default si no hay config)
  const [setSolu, setSetSolu] = useState<Set<string>>(
    new Set(initial.tagsLuzSolucionadas ?? TAGS_SOLUCIONADAS_DEFAULT),
  );
  const [setNo, setSetNo] = useState<Set<string>>(
    new Set(initial.tagsLuzNoContesta ?? TAGS_NO_CONTESTA_DEFAULT),
  );
  const [incluyeTransf, setIncluyeTransf] = useState<boolean>(
    initial.incluirTransferenciasLuz ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tipificaciones que estaban en defaults pero NO aparecen en los datos:
  // útil para que el admin pueda marcarlas/desmarcarlas anticipadamente.
  const tagsConocidas = new Set(tipificacionesLuz.map(t => t.norm));
  const tagsExtra: Array<{ tag: string; n: number; norm: string }> = [
    ...TAGS_SOLUCIONADAS_DEFAULT,
    ...TAGS_NO_CONTESTA_DEFAULT,
  ].filter(t => !tagsConocidas.has(t)).map(t => ({ tag: t, n: 0, norm: t }));
  const todasLasTipif = [...tipificacionesLuz, ...tagsExtra];

  function toggleSolu(norm: string) {
    setSetSolu(prev => {
      const nx = new Set(prev);
      if (nx.has(norm)) nx.delete(norm); else nx.add(norm);
      return nx;
    });
  }
  function toggleNo(norm: string) {
    setSetNo(prev => {
      const nx = new Set(prev);
      if (nx.has(norm)) nx.delete(norm); else nx.add(norm);
      return nx;
    });
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const next: ComisionConfig = {
        ...initial,
        tagsLuzSolucionadas: [...setSolu],
        tagsLuzNoContesta: [...setNo],
        incluirTransferenciasLuz: incluyeTransf,
      };
      const r = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: next }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? 'Error al guardar.'); return; }
      setSavedAt(Date.now());
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo contactar al servidor.');
    } finally { setSaving(false); }
  }

  function resetMayo() {
    // Plantilla del esquema vigente desde mayo: quitar del universo
    // las tipificaciones marcadas para excluir
    const aQuitar = new Set([
      'no contesta mensaje del asesor',
      'ticket cerrado por inactividad',
      'no quiere que lo vuelvan a contactar',
      'numero de empresa',
    ]);
    setSetNo(prev => {
      const nx = new Set(prev);
      aQuitar.forEach(t => nx.delete(t));
      return nx;
    });
    setIncluyeTransf(false);
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Universo de tipificaciones"
        title="Configura qué cuenta como solucionada y qué no"
        subtitle="Marca cada tipificación según si suma como 'solucionada' (numerador) o resta como 'no contesta' (denominador)."
      />

      <div className="bg-aqua-100 border border-aqua-300 rounded-xl p-4 mb-5 text-[12.5px] text-aqua-700 leading-relaxed flex items-start gap-3">
        <div className="font-bold text-aqua-700 shrink-0">i</div>
        <div>
          <p className="mb-1.5">
            <strong>Tasa de resolución</strong> = solucionadas (✓ verde) ÷ contestadas. Donde "contestadas" = cerradas − no-contesta (✗ ámbar). Las tipificaciones sin marca son neutras: cuentan como cerradas pero no suman al numerador.
          </p>
          <p>
            Vigente desde mayo el equipo plantea quitar del universo: <em>no contesta mensaje del asesor</em>, <em>ticket cerrado por inactividad</em>, <em>no quiere que lo vuelvan a contactar</em>, <em>número de empresa</em>. Click en <strong>"Aplicar plantilla mayo"</strong> abajo para preconfigurar.
          </p>
        </div>
      </div>

      {/* Toggle de transferencias */}
      <div className="bg-bg/60 border border-line rounded-xl p-4 mb-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-ink">Incluir transferencias en cerradas</div>
          <div className="text-[11.5px] text-muted">
            Por defecto las atenciones que se transfieren a otra cola NO entran al universo. Activa esto si decides incluirlas.
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={incluyeTransf}
            onChange={e => setIncluyeTransf(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-line2 rounded-full peer peer-checked:bg-aqua-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>

      {/* Tabla de tipificaciones */}
      <div className="border border-line rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-bg/60">
              <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted">Tipificación</th>
              <th className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted">Chats</th>
              <th className="px-3 py-3 text-center text-[10.5px] font-semibold uppercase tracking-wider text-aqua-700">✓ Solucionada</th>
              <th className="px-3 py-3 text-center text-[10.5px] font-semibold uppercase tracking-wider text-gold-700">✗ No contesta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {todasLasTipif.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted2 text-[12.5px]">
                  Aún no hay tipificaciones registradas para Luz. Sube un CSV con datos de Luz para que aparezcan aquí.
                </td>
              </tr>
            )}
            {todasLasTipif.map(t => {
              const esSolu = setSolu.has(t.norm);
              const esNo = setNo.has(t.norm);
              const isDefault = TAGS_SOLUCIONADAS_DEFAULT.includes(t.norm) || TAGS_NO_CONTESTA_DEFAULT.includes(t.norm);
              return (
                <tr key={t.norm} className="hover:bg-bg/40">
                  <td className="px-4 py-3">
                    <div className="text-[13px] text-ink2 font-medium">{t.tag}</div>
                    <div className="text-[10.5px] text-muted2 mt-0.5">
                      {isDefault && <span className="mr-1.5">por defecto · </span>}
                      <code className="font-mono text-[10px]">{t.norm}</code>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular text-ink2 font-semibold">
                    {t.n > 0 ? nf(t.n) : <span className="text-muted2">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={esSolu}
                      onChange={() => toggleSolu(t.norm)}
                      className="w-4 h-4 rounded border-line2 accent-aqua-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={esNo}
                      onChange={() => toggleNo(t.norm)}
                      className="w-4 h-4 rounded border-line2 accent-gold-500 cursor-pointer"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mt-4 text-[13px] text-gold-700 bg-gold-100 border border-gold-300 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={resetMayo}
          className="btn-ghost text-[12px]"
        >
          Aplicar plantilla mayo
        </button>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-[12px] text-aqua-700">Universo guardado</span>}
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================ USERS
function UsersCard({ usuarios }: { usuarios: UserPub[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, { display: string; pwd: string }>>(
    Object.fromEntries(usuarios.map(u => [u.username, { display: u.display, pwd: '' }])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ user: string; ok: boolean; text: string } | null>(null);

  async function guardarNombre(user: string) {
    const nuevo = edits[user]?.display ?? '';
    setBusy(user + ':name'); setMsg(null);
    try {
      const r = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, display: nuevo }),
      });
      const data = await r.json();
      if (!r.ok) setMsg({ user, ok: false, text: data.error ?? 'Error al renombrar.' });
      else {
        setMsg({ user, ok: true, text: `Nombre actualizado a "${data.display}".` });
        router.refresh();
      }
    } finally { setBusy(null); }
  }

  async function resetPwd(user: string) {
    const nueva = edits[user]?.pwd ?? '';
    if (!nueva || nueva.length < 6) {
      setMsg({ user, ok: false, text: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    setBusy(user + ':pwd'); setMsg(null);
    try {
      const r = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, nueva }),
      });
      const data = await r.json();
      if (!r.ok) setMsg({ user, ok: false, text: data.error ?? 'Error al cambiar la contraseña.' });
      else {
        setMsg({ user, ok: true, text: 'Contraseña actualizada.' });
        setEdits(prev => ({ ...prev, [user]: { ...prev[user], pwd: '' } }));
      }
    } finally { setBusy(null); }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Cuentas y credenciales"
        title="Gestión de usuarios"
        subtitle="Cambia el nombre que se muestra en la plataforma o restablece contraseñas"
      />
      <div className="space-y-3">
        {usuarios.map(u => (
          <div key={u.username} className="bg-bg/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10.5px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 font-mono">
                {u.username}
              </span>
              <div className="text-[12px] text-muted2 capitalize">{u.rol}</div>
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="eyebrow text-[9.5px] mb-1 block">Nombre visible</label>
                  <input
                    type="text"
                    value={edits[u.username]?.display ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [u.username]: { ...prev[u.username], display: e.target.value } }))}
                    className="input-field"
                  />
                </div>
                <button
                  onClick={() => guardarNombre(u.username)}
                  disabled={busy === u.username + ':name' || edits[u.username]?.display === u.display}
                  className="btn-ghost mt-5"
                >
                  {busy === u.username + ':name' ? 'Guardando…' : 'Guardar'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="eyebrow text-[9.5px] mb-1 block">Nueva contraseña</label>
                  <input
                    type="text"
                    placeholder="Mínimo 6 caracteres"
                    value={edits[u.username]?.pwd ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [u.username]: { ...prev[u.username], pwd: e.target.value } }))}
                    className="input-field"
                  />
                </div>
                <button
                  onClick={() => resetPwd(u.username)}
                  disabled={busy === u.username + ':pwd' || !edits[u.username]?.pwd}
                  className="btn-ghost mt-5"
                >
                  {busy === u.username + ':pwd' ? 'Guardando…' : 'Restablecer'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {msg && (
        <div
          className={`mt-4 text-[13px] rounded-lg px-4 py-3 ${
            msg.ok ? 'text-aqua-700 bg-aqua-100 border border-aqua-300' : 'text-gold-700 bg-gold-100 border border-gold-300'
          }`}
        >
          <strong className="capitalize">{msg.user}:</strong> {msg.text}
        </div>
      )}
    </Card>
  );
}

// ============================================================ ESQUEMAS HISTÓRICOS
function EsquemasHistoricosCard({
  kind, vigente,
}: { kind: 'ventas' | 'luz'; vigente?: ComisionConfig }) {
  const [abierto, setAbierto] = useState(false);

  // Agrupamos meses contiguos que comparten exactamente el mismo snapshot
  // (mismo objeto referencial). Así no repetimos la misma tabla 4 veces para
  // feb/mar/abr/may si todos comparten ESQUEMA_MAY_2026.
  type Snap = { baseSol: number; pilar1: TramoP1[]; pilar2: TramoP2[]; luzEsquema?: ComisionConfig['luzEsquema'] };
  type Grupo = { etiqueta: string; vigente: boolean; snap: Snap };

  const grupos: Grupo[] = (() => {
    const meses = ordenarMeses(Object.keys(ESQUEMAS_HISTORICOS) as MesKey[]);
    const acc: Array<{ meses: MesKey[]; snap: NonNullable<typeof ESQUEMAS_HISTORICOS[MesKey]> }> = [];
    for (const m of meses) {
      const s = ESQUEMAS_HISTORICOS[m];
      if (!s) continue;
      const ultimo = acc[acc.length - 1];
      if (ultimo && ultimo.snap === s) ultimo.meses.push(m);
      else acc.push({ meses: [m], snap: s });
    }
    const out: Grupo[] = acc.map(g => ({
      etiqueta: g.meses.length === 1
        ? `${MES_LABEL[g.meses[0]]} 2026`
        : `${MES_LABEL[g.meses[0]]} – ${MES_LABEL[g.meses[g.meses.length - 1]]} 2026`,
      vigente: false,
      snap: g.snap,
    }));
    if (vigente) {
      out.push({
        etiqueta: 'Junio 2026 en adelante',
        vigente: true,
        snap: {
          baseSol: vigente.baseSol,
          pilar1: vigente.pilar1,
          pilar2: vigente.pilar2,
          luzEsquema: vigente.luzEsquema,
        },
      });
    }
    return out;
  })();

  if (grupos.length === 0) return null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <p className="eyebrow mb-1">Histórico · solo lectura</p>
          <h3 className="font-display text-[16px] font-semibold text-ink">
            Esquemas usados en meses anteriores
          </h3>
          <p className="text-[12px] text-muted mt-1">
            Las cifras de meses cerrados siempre se calculan con el esquema que estuvo vigente en ese momento, no con el actual.
          </p>
        </div>
        <span
          className="text-[18px] text-muted2 ml-3 select-none transition-transform"
          style={{ transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          ⌄
        </span>
      </button>

      {abierto && (
        <div className="mt-5 space-y-5">
          {grupos.map((g, i) => (
            <div
              key={i}
              className="border rounded-xl p-5"
              style={{
                background: g.vigente ? '#E0F1F3' + '40' : '#FAFBFE',
                borderColor: g.vigente ? '#00A29B' : '#E4E7F2',
              }}
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="font-display text-[14px] font-semibold text-ink">
                  {g.etiqueta}
                </p>
                <div className="flex items-center gap-2">
                  {g.vigente && <Pill tone="aqua">Vigente</Pill>}
                  <Pill tone="blue">Base {formatSol(g.snap.baseSol)}</Pill>
                </div>
              </div>
              {kind === 'ventas' ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <EsquemaHistTablaP1 tramos={g.snap.pilar1} base={g.snap.baseSol} />
                  <EsquemaHistTablaP2 tramos={g.snap.pilar2} />
                </div>
              ) : (
                <EsquemaHistLuz luzEsquema={g.snap.luzEsquema} />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EsquemaHistTablaP1({ tramos, base }: { tramos: TramoP1[]; base: number }) {
  return (
    <div>
      <p className="eyebrow mb-2">Pilar 1 · % Sol/Cerradas → multiplicador</p>
      <table className="w-full text-[12.5px] tabular">
        <thead>
          <tr className="text-left text-muted text-[10.5px] uppercase tracking-wider border-b border-line">
            <th className="py-2">Tramo</th>
            <th className="py-2 text-right">Mul</th>
            <th className="py-2 text-right">Aplica</th>
            <th className="py-2 text-right">Piso aten</th>
          </tr>
        </thead>
        <tbody>
          {tramos.map((t, i) => (
            <tr key={i} className="border-b border-line/50">
              <td className="py-2">{t.label}</td>
              <td className="py-2 text-right">{t.mul}×</td>
              <td className="py-2 text-right">{formatSol(Math.round(base * t.mul))}</td>
              <td className="py-2 text-right text-muted2">
                {t.pisoAten ? t.pisoAten.toLocaleString('es-PE') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EsquemaHistTablaP2({ tramos }: { tramos: TramoP2[] }) {
  return (
    <div>
      <p className="eyebrow mb-2">Pilar 2 · AE del mes → bono fijo</p>
      <table className="w-full text-[12.5px] tabular">
        <thead>
          <tr className="text-left text-muted text-[10.5px] uppercase tracking-wider border-b border-line">
            <th className="py-2">Tramo</th>
            <th className="py-2 text-right">Bono</th>
          </tr>
        </thead>
        <tbody>
          {tramos.map((t, i) => (
            <tr key={i} className="border-b border-line/50">
              <td className="py-2">{t.label}</td>
              <td className="py-2 text-right">{t.bono === 0 ? '—' : `+${formatSol(t.bono)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EsquemaHistLuz({ luzEsquema }: { luzEsquema: ComisionConfig['luzEsquema'] }) {
  if (!luzEsquema) return <p className="text-[12px] text-muted">Sin datos.</p>;
  // Soporta tanto el shape escalonado (tramos) como el legacy single threshold
  if (luzEsquema.tramos && luzEsquema.tramos.length > 0) {
    const ord = [...luzEsquema.tramos].sort((a, b) => a.min - b.min);
    return (
      <div>
        <p className="eyebrow mb-2">Comisión Luz · escalonado</p>
        <table className="w-full text-[12.5px] tabular max-w-sm">
          <thead>
            <tr className="text-left text-muted text-[10.5px] uppercase tracking-wider border-b border-line">
              <th className="py-2">Umbral mínimo</th>
              <th className="py-2 text-right">Bono</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/50">
              <td className="py-2">{`< ${ord[0].min}%`}</td>
              <td className="py-2 text-right text-muted2">—</td>
            </tr>
            {ord.map((t, i) => (
              <tr key={i} className="border-b border-line/50">
                <td className="py-2">{`≥ ${t.min}%`}</td>
                <td className="py-2 text-right">{formatSol(t.bono)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // Legacy todo-o-nada
  const u = luzEsquema.umbralPct ?? 60;
  const b = luzEsquema.bono ?? 300;
  return (
    <div>
      <p className="eyebrow mb-2">Comisión Luz · todo o nada</p>
      <p className="text-[13px] text-ink2">
        Si la tasa de resolución llega al <strong>{u}%</strong>, Luz cobra {formatSol(b)}. Si no, S/0.
      </p>
    </div>
  );
}
