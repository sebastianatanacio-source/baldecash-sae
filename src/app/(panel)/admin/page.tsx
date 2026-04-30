import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/storage/snapshot';
import { loadConfig } from '@/lib/storage/config';
import { loadUsers } from '@/lib/auth/users';
import AdminView from './AdminView';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session.rol) redirect('/login');
  if (session.rol !== 'admin') redirect('/resumen');

  const [snap, cfg, users] = await Promise.all([loadSnapshot(), loadConfig(), loadUsers()]);
  const usersPub = users.map(u => ({ username: u.username, rol: u.rol, display: u.display }));
  return <AdminView snapshotMeta={snap?.meta ?? null} config={cfg} users={usersPub} />;
}
