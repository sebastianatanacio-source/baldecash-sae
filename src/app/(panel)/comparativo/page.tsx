import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/storage/snapshot';
import { loadConfig } from '@/lib/storage/config';
import { EmptyState } from '@/components/ui/EmptyState';
import ComparativoView from './ComparativoView';

export const dynamic = 'force-dynamic';

export default async function ComparativoPage() {
  const session = await getSession();
  if (!session.rol) redirect('/login');
  if (session.rol === 'fernanda' || session.rol === 'stefania' || session.rol === 'julio') {
    redirect(`/agente/${session.rol}`);
  }
  const [snap, cfg] = await Promise.all([loadSnapshot(), loadConfig()]);

  if (!snap) {
    return (
      <EmptyState
        title="Aún no hay información cargada"
        description="El comparativo se generará cuando el administrador cargue los archivos de Blip y Admin."
        actionHref={session.rol === 'admin' ? '/admin' : undefined}
        actionLabel={session.rol === 'admin' ? 'Ir al panel de carga' : undefined}
      />
    );
  }
  return <ComparativoView snapshot={snap} config={cfg} />;
}
