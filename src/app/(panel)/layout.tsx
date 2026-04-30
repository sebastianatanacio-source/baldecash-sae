import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/storage/snapshot';
import Header from '@/components/layout/Header';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.rol) redirect('/login');

  const snap = await loadSnapshot();

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        rol={session.rol}
        display={session.display ?? session.rol}
        generadoEn={snap?.meta?.generadoEn ?? null}
      />
      <main className="flex-1 px-6 lg:px-10 py-7">{children}</main>
      <footer className="border-t border-line bg-white px-6 lg:px-10 py-4 text-[11px] text-muted2">
        © {new Date().getFullYear()} BaldeCash · Rumbo · Uso interno
      </footer>
    </div>
  );
}
