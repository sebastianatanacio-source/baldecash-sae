'use client';

import { Card, CardHeader } from './Card';
import { calcularComisionLuz, formatSol } from '@/lib/domain/comisiones';
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

  // Para Luz mostramos el esquema todo-o-nada
  if (blipOnly) {
    const luz = calcularComisionLuz(pilar2Valor, config);
    return (
      <Card padding="p-0">
        <div className="px-6 pt-6 pb-4 border-b border-line">
          <CardHeader
            eyebrow="Esquema vigente"
            title="Cómo se calcula tu comisión"
            subtitle="Esquema todo-o-nada: pasas el umbral o no comisionas"
          />
        </div>

        <div className="p-6">
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {/* No cumple el umbral */}
            <div
              className={`flex items-center justify-between rounded-xl px-4 py-4 border-2 transition-all ${
                !luz.cumple ? 'shadow-card' : ''
              }`}
              style={{
                background: !luz.cumple ? '#FFF7E6' : '#FAFBFE',
                borderColor: !luz.cumple ? '#D1A646' : '#E4E7F2',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-gold-400 shrink-0" />
                <div>
                  <div className="font-semibold text-[13px] text-ink">{`< ${luz.umbralPct}% de resolución`}</div>
                  <div className="text-[11px] text-muted mt-0.5">No comisiona este mes</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-semibold text-[18px] tabular text-gold-700">{formatSol(0)}</div>
                {!luz.cumple && (
                  <div className="text-[9.5px] uppercase tracking-wider font-bold text-gold-700 mt-0.5">Estado actual</div>
                )}
              </div>
            </div>

            {/* Cumple el umbral */}
            <div
              className={`flex items-center justify-between rounded-xl px-4 py-4 border-2 transition-all ${
                luz.cumple ? 'shadow-card' : ''
              }`}
              style={{
                background: luz.cumple ? agenteColor + '14' : '#FAFBFE',
                borderColor: luz.cumple ? agenteColor : '#E4E7F2',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: agenteColor }} />
                <div>
                  <div className="font-semibold text-[13px] text-ink">{`≥ ${luz.umbralPct}% de resolución`}</div>
                  <div className="text-[11px] text-muted mt-0.5">Comisión completa</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-semibold text-[18px] tabular" style={{ color: agenteColor }}>
                  {formatSol(luz.bono)}
                </div>
                {luz.cumple && (
                  <div className="text-[9.5px] uppercase tracking-wider font-bold mt-0.5" style={{ color: agenteColor }}>
                    Estado actual
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-bg/40 border border-line rounded-lg p-4 text-[12.5px] text-ink2 leading-relaxed">
            <p className="font-semibold text-ink mb-1.5">Cómo se mide</p>
            <p className="text-muted">
              <strong className="text-ink2">Tasa de resolución</strong> = consultas solucionadas (universo unificado de tipificaciones SAE) ÷ conversaciones contestadas (cerradas que no son "no contesta") × 100.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Esquema vigente desde mayo 2026 para no-Luz:
  //   Pilar 1 = % Sol / Cerradas → multiplicador (sin guardrail aplicado aquí
  //             por simplicidad — el guardrail se respeta en el cálculo real)
  //   Pilar 2 = AE del mes → bono fijo
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

  return (
    <Card padding="p-0">
      <div className="px-6 pt-6 pb-4 border-b border-line">
        <CardHeader
          eyebrow="Esquema vigente · mayo 2026"
          title="Cómo se calcula tu comisión"
          subtitle={`Comisión base del Pilar 1: ${formatSol(baseSol)} · El tramo donde estás ahora aparece resaltado`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-0">
        {/* PILAR 1 — % Sol / Cerradas → Multiplicador */}
        <div className="p-6 border-b lg:border-b-0 lg:border-r border-line">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-bold text-[12px]" style={{ color: agenteColor }}>P1</span>
              <h4 className="font-display font-semibold text-[14px] text-ink">% Sol / Cerradas × Multiplicador</h4>
            </div>
            <p className="text-[11.5px] text-muted">
              Calculamos el porcentaje de solicitudes que ingresaste (con tu cupón) sobre las conversaciones cerradas
              por ti del mes (las transferidas no entran). Cada tramo activa un multiplicador sobre la base de {formatSol(baseSol)}.
              Tramos altos requieren un piso mínimo de atenciones (guardrail anti-gaming).
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
                        {t.mul === 0
                          ? 'Sin comisión este mes'
                          : `Multiplicador ${t.mul}× sobre ${formatSol(baseSol)}`}
                        {t.pisoAten ? ` · requiere ≥${t.pisoAten.toLocaleString('es-PE')} aten.` : ''}
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

        {/* PILAR 2 — AE del mes → Bono fijo */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-bold text-[12px] text-gold-600">P2</span>
              <h4 className="font-display font-semibold text-[14px] text-ink">AE del mes → Bono fijo</h4>
            </div>
            <p className="text-[11.5px] text-muted">
              Bono adicional según la cantidad de aprobadas-entregadas (cupón + preowner) del mes. Es complemento al Pilar 1
              y se suma directo a la comisión final.
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
                        {t.bono === 0 ? 'Sin bono' : i === tramos2.length - 1 ? 'Bono máximo' : 'Bono progresivo'}
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
        <strong className="text-ink2">Comisión final</strong> = Base × Multiplicador (% Sol/Cerradas) + Bono (AE del mes)
      </div>
    </Card>
  );
}
