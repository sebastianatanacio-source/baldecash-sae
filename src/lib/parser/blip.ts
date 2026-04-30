// ============================================================
// Parser server-side del CSV de Blip (AgentHistory_*.csv)
// ============================================================
// Lee atenciones, deja-solicitud, métricas operativas (cola, FRT, ART),
// distribución por canal, tags de cierre y serie diaria.
//
// Validado contra los hardcoded de reporte_metas_sae_v4_1.html — todos los
// totales feb/mar/abr 2026 cuadran al 100%.

import { detectarAgente, AGENTES_LIST } from '@/lib/domain/agentes';
import { MES_MAP } from '@/lib/domain/meses';
import type { AgenteSlug, MesKey } from '@/lib/domain/types';

interface BlipAcc {
  aten: number;
  deja: number;
  qtSum: number; qtN: number;
  frtSum: number; frtN: number;
  artSum: number; artN: number;
  canales: { whatsapp: number; facebook: number; otro: number };
  tags: Map<string, number>;
  diario: Map<string, { aten: number; deja: number; dow: number }>;
  hora: number[]; // 24
}

const newAcc = (): BlipAcc => ({
  aten: 0, deja: 0,
  qtSum: 0, qtN: 0, frtSum: 0, frtN: 0, artSum: 0, artN: 0,
  canales: { whatsapp: 0, facebook: 0, otro: 0 },
  tags: new Map(),
  diario: new Map(),
  hora: new Array(24).fill(0),
});

export interface BlipResultado {
  /** Por agente y mes */
  porAgenteMes: Map<AgenteSlug, Map<MesKey, BlipAcc>>;
  /** Stats globales */
  filasLeidas: number;
  filasDescartadas: { sinAgente: number; fueraDeRango: number; fechaInvalida: number };
  rangoMeses: Set<MesKey>;
}

/**
 * Parsea el CSV completo a partir de un string ya decodificado.
 * Separador: ';'. Comillas dobles soportadas (campos con saltos de línea internos).
 */
export function parseBlipCsv(csvText: string): BlipResultado {
  const rows = splitCsvRows(csvText, ';');
  if (rows.length === 0) {
    return { porAgenteMes: new Map(), filasLeidas: 0, filasDescartadas: { sinAgente: 0, fueraDeRango: 0, fechaInvalida: 0 }, rangoMeses: new Set() };
  }
  // Header
  const header = rows[0].map(h => h.replace(/^﻿/, '').trim());
  const idxAgent  = header.indexOf('AgentName');
  const idxStorage= header.indexOf('StorageDate');
  const idxTags   = header.indexOf('Tags');
  const idxQT     = header.indexOf('QueueTime');
  const idxFRT    = header.indexOf('FirstResponseTime');
  const idxART    = header.indexOf('AverageResponseTime');
  const idxTeam   = header.indexOf('Team');
  const idxStatus = header.indexOf('Status');
  // Canal: en algunos exports viene "Canal" o se infiere del Team / no existe.
  // Por seguridad, intentamos varias claves.
  const idxCanal = ['Canal', 'Channel', 'Source'].map(k => header.indexOf(k)).find(i => i >= 0) ?? -1;

  if (idxAgent < 0 || idxStorage < 0) {
    throw new Error(
      `CSV de Blip inválido: faltan columnas requeridas. Encontradas: ${header.slice(0, 20).join(', ')}…`,
    );
  }

  const porAgenteMes = new Map<AgenteSlug, Map<MesKey, BlipAcc>>();
  const rangoMeses = new Set<MesKey>();
  let filasLeidas = 0, sinAgente = 0, fueraDeRango = 0, fechaInvalida = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || (row.length === 1 && row[0].trim() === '')) continue;
    filasLeidas++;

    const ag = detectarAgente(row[idxAgent]);
    if (!ag) { sinAgente++; continue; }

    const dt = parseDateTime((row[idxStorage] || '').slice(0, 19));
    if (!dt) { fechaInvalida++; continue; }
    const mesISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const mes = MES_MAP[mesISO];
    if (!mes) { fueraDeRango++; continue; }

    rangoMeses.add(mes);

    let porMes = porAgenteMes.get(ag);
    if (!porMes) { porMes = new Map(); porAgenteMes.set(ag, porMes); }
    let acc = porMes.get(mes);
    if (!acc) { acc = newAcc(); porMes.set(mes, acc); }

    acc.aten++;

    // Día y dow
    const day = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const jsDow = dt.getDay(); // 0=Sun
    const dow = (jsDow + 6) % 7; // 0=Lun..6=Dom
    let dia = acc.diario.get(day);
    if (!dia) { dia = { aten: 0, deja: 0, dow }; acc.diario.set(day, dia); }
    dia.aten++;

    // Hora
    acc.hora[dt.getHours()] += 1;

    // Tags
    const tagsRaw = idxTags >= 0 ? (row[idxTags] || '') : '';
    const isDeja = tagsRaw.includes('Deja solicitud');
    if (isDeja) { acc.deja++; dia.deja++; }
    // Detectar tags individuales — formato JSON ["a","b"] o texto
    parseTags(tagsRaw).forEach(t => {
      acc!.tags.set(t, (acc!.tags.get(t) ?? 0) + 1);
    });

    // Métricas operativas
    pushNum(row[idxQT],  v => { acc!.qtSum += v; acc!.qtN++; });
    pushNum(row[idxFRT], v => { acc!.frtSum += v; acc!.frtN++; });
    pushNum(row[idxART], v => { acc!.artSum += v; acc!.artN++; });

    // Canal
    const canalRaw = idxCanal >= 0 ? (row[idxCanal] || '') : (idxTeam >= 0 ? row[idxTeam] || '' : '');
    const canal = clasificarCanal(canalRaw);
    acc.canales[canal] += 1;
  }

  return {
    porAgenteMes,
    filasLeidas,
    filasDescartadas: { sinAgente, fueraDeRango, fechaInvalida },
    rangoMeses,
  };
}

/** Suelo de seguridad: descarta filas con QT/FRT/ART > 1000 (artefactos de cierre tardío). */
function pushNum(raw: string | undefined, cb: (v: number) => void) {
  if (raw == null || raw === '') return;
  const v = parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(v) || v < 0 || v > 1000) return;
  cb(v);
}

function parseDateTime(s: string): Date | null {
  if (!s) return null;
  // Formato esperado "YYYY-MM-DD HH:MM:SS" o "YYYY-MM-DD"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [_, Y, Mo, D, H = '0', Mi = '0', S = '0'] = m;
  const dt = new Date(Number(Y), Number(Mo) - 1, Number(D), Number(H), Number(Mi), Number(S));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseTags(raw: string): string[] {
  const s = (raw || '').trim();
  if (!s) return [];
  // Caso 1: JSON array '["a","b"]'
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(x => String(x).trim()).filter(Boolean);
    } catch {/* ignore, cae a fallback */}
  }
  // Caso 2: separado por '|' o ','
  return s.split(/[|,]/).map(x => x.replace(/^["'\[]+|["'\]]+$/g, '').trim()).filter(Boolean);
}

function clasificarCanal(raw: string): 'whatsapp' | 'facebook' | 'otro' {
  const s = (raw || '').toLowerCase();
  if (s.includes('whatsapp') || s.includes('wa') || s === '') return 'whatsapp';
  if (s.includes('facebook') || s.includes('messenger') || s.includes('fb')) return 'facebook';
  return 'otro';
}

/**
 * Splitter de CSV con soporte para comillas dobles y saltos internos.
 * Suficientemente rápido para 25-50k filas.
 */
function splitCsvRows(text: string, sep: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; }
      else cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); out.push(row); }
  return out;
}
