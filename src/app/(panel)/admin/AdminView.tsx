'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Chips';
import { fechaCorta, nf } from '@/lib/domain/helpers';
import { buildSnapshot } from '@/lib/parser';
import type { ComisionConfig, SnapshotMeta } from '@/lib/domain/types';

interface UserPub { username: 'admin' | 'jefa' | 'fernanda' | 'stefania' | 'julio' | 'luz'; rol: string; display: string }

export default function AdminView({
  snapshotMeta, config, users,
}: { snapshotMeta: SnapshotMeta | null; config: ComisionConfig; users: UserPub[] }) {
  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow mb-2">Administración</p>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">
          Configuración del sistema
        </h1>
        <p className="text-[13.5px] text-muted mt-2 max-w-3xl">
          Carga diaria de archivos, ajuste de los tramos del esquema de comisiones y gestión de credenciales del equipo.
        </p>
      </header>

      <UploadCard meta={snapshotMeta} />

      <ConfigCard config={config} />

      <UsersCard usuarios={users} />
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

      // 2. Enviar el snapshot procesado (≈13 KB) al server para persistirlo
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
          blip: report.blip,
          admin: report.admin,
          warnings: report.warnings,
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
        subtitle="Sube el CSV de Blip (AgentHistory) y el XLSX de Admin (reporte_solicitudes)"
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
          {Array.isArray(result.warnings) && result.warnings.length > 0 && (
            <ul className="text-gold-700 list-disc pl-5 mt-1.5">
              {result.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-3">
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
          <p className="eyebrow mb-2">Pilar 1 — AE × multiplicador</p>
          {cfg.pilar1.map((t, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2">
              <input
                type="number" min={0}
                value={t.min}
                onChange={e => {
                  const next = [...cfg.pilar1]; next[i] = { ...t, min: Number(e.target.value || 0) };
                  setCfg({ ...cfg, pilar1: next });
                }}
                placeholder="AE mín"
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
          <p className="eyebrow mb-2">Pilar 2 — % Sol → bono</p>
          {cfg.pilar2.map((t, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2">
              <input
                type="number" min={0} step={0.5}
                value={t.min}
                onChange={e => {
                  const next = [...cfg.pilar2]; next[i] = { ...t, min: Number(e.target.value || 0) };
                  setCfg({ ...cfg, pilar2: next });
                }}
                placeholder="% mín"
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
