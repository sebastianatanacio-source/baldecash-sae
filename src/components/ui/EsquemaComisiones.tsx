'use client';

import { Card, CardHeader } from './Card';
import { formatSol } from '@/lib/domain/comisiones';
import { basePara, tramosP1Para, tramosP2Para } from '@/lib/domain/helpers';
import { esBlipOnly } from '@/lib/domain/agentes';
import type { AgenteSlug, ComisionConfig } from '@/lib/domain/types';

/**
 * Tabla visual del esquema de comisiones, marcando el tramo activo
 * para los valores actuales del agente.
 *
 * Soporta los dos esquemas: el general (AE + %Sol/Aten) y el blip-only (Luz).
 */
export function EsquemaComisiones({
  config,
  agenteSlug,
  pilar1Valor,
  pilar2Valor,
  pilar1Etiqueta,
  pilar2NumeradorEtiqueta,
  agenteColor,
}: {
  config: ComisionConfig;
  agenteSlug: AgenteSlug;
  /** Valor actual del Pilar 1: AE para la mayoría, deja-sol para Luz */
  pilar1Valor: number;
  /** Valor actual del Pilar 2: %Sol/Aten para la mayoría, %Deja/Aten para Luz */
  pilar2Valor: number;
  /** Etiqueta plural del numerador del P1 (ej. "aprobadas-entregadas", "deja-solicitud") */
  pilar1Etiqueta: string;
  /** Etiqueta del numerador del P2 (ej. "solicitudes", "deja-solicitud") */
  pilar2NumeradorEtiqueta: string;
  agenteColor: string;
}) {
  const baseSol = basePara(agenteSlug, config);
  const tramos1 = tramosP1Para(agenteSlug, config);
  const tramos2 = tramosP2Para(agenteSlug, config);
  const blipOnly = esBlipOnly(agenteSlug);

  const tramoP1Idx = (() => {
    let idx = 0;
    tramos1.forEach((t, i) => { if (pilar1Valor >= t.min) idx = i; });
    return idx;
  })();

  const tramoP2Idx = (() => {
    let idx = 0;
    tramos2.forEach((t, i) => { if (pilar2Valor >= t.min) idx = i; });
    return idx;
  })();

  const p1Capitalizada = pilar1Etiqueta.charAt(0).toUpperCase() + pilar1Etiqueta.slice(1);

  return (
    <Card padding="p-0">
      <div className="px-6 pt-6 pb-4 border-b border-line">
        <CardHeader
          eyebrow="Esquema vigente"
          title="Cómo se calcula tu comisión"
          subtitle={`Base mensual del Pilar 1: ${formatSol(baseSol)} · El tramo donde estás ahora aparece resaltado`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-0">
        {/* PILAR 1 */}
        <div className="p-6 border-b lg:border-b-0 lg:border-r border-line">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-bold text-[12px]" style={{ color: agenteColor }}>P1</span>
              <h4 className="font-display font-semibold text-[14px] text-ink">{p1Capitalizada} × Multiplicador</h4>
            </div>
            <p className="text-[11.5px] text-muted">
              {blipOnly
                ? `Sumamos todos los chats que tipificaste dentro del universo unificado de "consultas solucionadas" (esquema histórico + esquema nuevo desde el 15-abr-2026) y aplicamos el multiplicador del tramo a la base de ${formatSol(baseSol)}. Meta mensual: 1,100 solucionadas.`
                : `Sumamos todas tus aprobadas-entregadas del mes (cupón + preowner) y aplicamos el multiplicador del tramo a la base de ${formatSol(baseSol)}.`}
            </p>
          </div>
          <div className="space-y-1.5">
            {tramos1.map((t, i) => {
              const activo = i === tramoP1Idx;
              const aplicado = Math.round(baseSol * t.mul);
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-3 border transition-all ${
                    activo ? 'shadow-card' : ''
                  }`}
                  style={{
                    background: activo ? agenteColor + '14' : '#FAFBFE',
                    borderColor: activo ? agenteColor : '#E4E7F2',
                    borderWidth: activo ? 2 : 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: agenteColor,
                        opacity: 0.25 + (i / tramos1.length) * 0.75,
                      }}
                    />
                    <div>
                      <div className="font-semibold text-[12.5px] text-ink">
                        {t.label}
                      </div>
                      <div className="text-[10.5px] text-muted">
                        Multiplicador {t.mul}× sobre {formatSol(baseSol)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-semibold text-[15px] tabular" style={{ color: activo ? agenteColor : '#2E3358' }}>
                      {formatSol(aplicado)}
                    </div>
                    {activo && (
                      <div className="text-[9.5px] uppercase tracking-wider font-bold mt-0.5" style={{ color: agenteColor }}>
                        Tramo actual
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PILAR 2 */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-bold text-[12px] text-gold-600">P2</span>
              <h4 className="font-display font-semibold text-[14px] text-ink">
                {blipOnly ? 'Tasa de resolución · Guardrail de calidad' : '% Solicitudes / Atenciones → Bono'}
              </h4>
            </div>
            <p className="text-[11.5px] text-muted">
              {blipOnly
                ? 'Para cobrar el Pilar 1 tu tasa de resolución sobre contestadas debe ser ≥ 60%. La FRT mediana también debe estar ≤ 30 segundos. Si pasa el guardrail, además recibes el bono de la tabla.'
                : 'Bono adicional según el porcentaje de solicitudes ingresadas (con tu cupón) sobre las atenciones de Blip.'}
            </p>
          </div>
          <div className="space-y-1.5">
            {tramos2.map((t, i) => {
              const activo = i === tramoP2Idx;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-3 border transition-all ${
                    activo ? 'shadow-card' : ''
                  }`}
                  style={{
                    background: activo ? '#FFF7E6' : '#FAFBFE',
                    borderColor: activo ? '#D1A646' : '#E4E7F2',
                    borderWidth: activo ? 2 : 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: '#D1A646',
                        opacity: 0.25 + (i / tramos2.length) * 0.75,
                      }}
                    />
                    <div>
                      <div className="font-semibold text-[12.5px] text-ink">{t.label}</div>
                      <div className="text-[10.5px] text-muted">
                        {t.bono === 0 ? 'Sin bono' : i === tramos2.length - 1 ? 'Bono máximo' : i === 1 ? 'Bono básico' : 'Bono medio'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-semibold text-[15px] tabular text-gold-700">
                      {t.bono === 0 ? formatSol(0) : `+${formatSol(t.bono)}`}
                    </div>
                    {activo && (
                      <div className="text-[9.5px] uppercase tracking-wider font-bold text-gold-700 mt-0.5">
                        Tramo actual
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-line bg-bg/40 text-[12px] text-muted2 text-center">
        <strong className="text-ink2">Comisión final</strong> = Base × Multiplicador (Pilar 1) + Bono (Pilar 2)
      </div>
    </Card>
  );
}
