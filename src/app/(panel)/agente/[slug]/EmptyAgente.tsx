import { EmptyState } from '@/components/ui/EmptyState';
import { AGENTES } from '@/lib/domain/agentes';
import type { AgenteSlug } from '@/lib/domain/types';

export function EmptyAgente({
  slug, reason, rolPuedeCargar,
}: { slug: AgenteSlug; reason: 'no-data' | 'no-agent-data'; rolPuedeCargar: boolean }) {
  const spec = AGENTES[slug];
  if (reason === 'no-data') {
    return (
      <EmptyState
        title={`Aún no hay información para ${spec.nombre}`}
        description="El reporte se activará cuando el administrador cargue los archivos de Blip y Admin."
        actionHref={rolPuedeCargar ? '/admin' : undefined}
        actionLabel={rolPuedeCargar ? 'Ir al panel de carga' : undefined}
      />
    );
  }
  return (
    <EmptyState
      title={`Sin datos de ${spec.nombre} en este período`}
      description={`Los archivos cargados no contienen registros atribuibles a ${spec.nombre}. Verifica el nombre en Blip${spec.cupon ? ` y el cupón ${spec.cupon} en Admin` : ''}.`}
    />
  );
}
