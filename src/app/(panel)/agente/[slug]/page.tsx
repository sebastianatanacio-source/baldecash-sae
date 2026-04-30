import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { puedeVerAgente } from '@/lib/auth/users';
import { loadSnapshot } from '@/lib/storage/snapshot';
import { loadConfig } from '@/lib/storage/config';
import { AGENTES } from '@/lib/domain/agentes';
import { EmptyState } from '@/components/ui/EmptyState';
import AgenteView from './AgenteView';
import type { AgenteSlug } from '@/lib/domain/types';

// Esta ruta depende de cookies de sesión + lectura del snapshot persistido,
// nunca puede prerenderizarse estáticamente.
export const dynamic = 'force-dynamic';

const VALIDOS: AgenteSlug[] = ['fernanda', 'stefania', 'julio'];

export default async function AgentePage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session.rol) redirect('/login');
  const { slug } = await params;
  if (!VALIDOS.includes(slug as AgenteSlug)) notFound();
  if (!puedeVerAgente(session.rol, slug as 'fernanda' | 'stefania' | 'julio')) {
    redirect('/resumen');
  }

  const [snap, cfg] = await Promise.all([loadSnapshot(), loadConfig()]);
  const spec = AGENTES[slug as AgenteSlug];

  if (!snap) {
    return (
      <EmptyState
        title={`Aún no hay información para ${spec.nombre}`}
        description="El reporte se activará cuando el administrador cargue los archivos de Blip y Admin."
        actionHref={session.rol === 'admin' ? '/admin' : undefined}
        actionLabel={session.rol === 'admin' ? 'Ir al panel de carga' : undefined}
      />
    );
  }

  if (!snap.agentes[spec.slug]) {
    return (
      <EmptyState
        title={`Sin datos de ${spec.nombre} en este período`}
        description={`Los archivos cargados no contienen registros atribuibles a ${spec.nombre}. Verifica el nombre en Blip y el cupón ${spec.cupon || 'configurado'} en Admin.`}
      />
    );
  }

  return <AgenteView snapshot={snap} config={cfg} agenteSlug={spec.slug} />;
}
