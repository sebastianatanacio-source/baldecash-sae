'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Rol } from '@/lib/auth/users';

interface NavItem {
  href: string;
  label: string;
  roles: Rol[];
}

const NAV: NavItem[] = [
  { href: '/resumen',     label: 'Resumen',      roles: ['admin', 'jefa'] },
  { href: '/comparativo', label: 'Comparativo',  roles: ['admin', 'jefa'] },
  { href: '/metas',       label: 'Metas',        roles: ['admin', 'jefa'] },
  { href: '/admin',       label: 'Configuración', roles: ['admin'] },
];

export default function Header({
  rol,
  display,
  generadoEn,
}: {
  rol: Rol;
  display: string;
  generadoEn?: string | null;
}) {
  const path = usePathname();
  const router = useRouter();

  const items = NAV.filter(n => n.roles.includes(rol));
  const isAsesora = rol === 'fernanda' || rol === 'stefania' || rol === 'julio' || rol === 'luz';
  if (isAsesora) {
    items.push({ href: `/agente/${rol}`, label: 'Mi dashboard', roles: [rol] });
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-line">
      {/* fila superior */}
      <div className="px-6 lg:px-10 h-[60px] flex items-center justify-between">
        <Link href={isAsesora ? `/agente/${rol}` : '/resumen'} className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center text-white font-display font-bold text-lg">
            B
            <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-aqua-500" aria-hidden />
          </div>
          <div>
            <div className="font-display font-semibold text-[15px] text-ink leading-none">BaldeCash · <span style={{ color: '#00A29B' }}>Rumbo</span></div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted mt-0.5">Tu equipo, sus metas</div>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {generadoEn && (
            <div className="hidden md:block text-right">
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted2">Última actualización</div>
              <div className="text-[12px] font-medium text-ink2 tabular">{formatTimestamp(generadoEn)}</div>
            </div>
          )}

          <div className="hidden sm:block h-8 w-px bg-line" />

          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <div className="text-[12.5px] font-semibold text-ink leading-tight">{display}</div>
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted">{rol}</div>
            </div>
            <button onClick={logout} className="btn-ghost text-[12px] py-1.5 px-3">Salir</button>
          </div>
        </div>
      </div>

      {/* nav */}
      {items.length > 1 && (
        <nav className="px-6 lg:px-10 flex gap-1 -mt-px">
          {items.map(it => {
            const active = path === it.href || path.startsWith(it.href + '/');
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                  active
                    ? 'border-blue-700 text-ink'
                    : 'border-transparent text-muted hover:text-ink2'
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const dt = new Date(iso);
    const dia = String(dt.getDate()).padStart(2, '0');
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const mes = meses[dt.getMonth()];
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    return `${dia} ${mes} · ${hh}:${mm}`;
  } catch { return iso; }
}
