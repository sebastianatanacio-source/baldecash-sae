import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/storage/snapshot';
import { loadConfig } from '@/lib/storage/config';
import { EmptyState } from '@/components/ui/EmptyState';
import ResumenView from './ResumenView';

export const dynamic = 'force-dynamic';

export default async function ResumenPage() {
  const session = await getSession();
  if (!session.rol) redirect('/login');
  if (session.rol === 'fernanda' || session.rol === 'stefania' || session.rol === 'julio') {
    redirect(`/agente/${session.rol}`);
  }

  const [snap, config] = await Promise.all([loadSnapshot(), loadConfig()]);

  if (!snap) {
    return (
      <EmptyState
        title="Aún no hay información cargada"
        description="El reporte ejecutivo se generará en cuanto se carguen el archivo de Blip (AgentHistory.csv) y el de Admin (reporte_solicitudes.xlsx) desde el panel de configuración."
        actionHref={session.rol === 'admin' ? '/admin' : undefined}
        actionLabel={session.rol === 'admin' ? 'Ir al panel de carga' : undefined}
      />
    );
  }

  return <ResumenView snapshot={snap} rol={session.rol} config={config} />;
}
