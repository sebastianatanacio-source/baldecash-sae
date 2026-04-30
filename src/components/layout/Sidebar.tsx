'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Rol } from '@/lib/auth/users';
import { AGENTES_LIST } from '@/lib/domain/agentes';

interface ItemBase {
  href?: string;
  label: string;
  icon: React.ReactNode;
  /** Sub-items (un solo nivel de profundidad) */
  children?: Array<{ href: string; label: string; color?: string }>;
}

const I = {
  panel: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  meta: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  trend: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  history: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="14"/></svg>,
  team: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  scheme: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  compare: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  upload: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  cog: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  bills: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
};

function navForRol(rol: Rol): ItemBase[] {
  // ASESORAS — incluida Luz
  if (rol === 'fernanda' || rol === 'stefania' || rol === 'julio' || rol === 'luz') {
    const base = `/agente/${rol}`;
    return [
      { href: base,                 label: 'Mi panel',       icon: I.panel },
      { href: `${base}/metas`,      label: 'Mis metas',      icon: I.meta },
      { href: `${base}/rendimiento`,label: 'Mi rendimiento', icon: I.trend },
      { href: `${base}/historico`,  label: 'Mi histórico',   icon: I.history },
    ];
  }

  // ADMIN
  if (rol === 'admin') {
    return [
      { href: '/resumen',           label: 'Equipo',         icon: I.team },
      {
        label: 'Por asesora', icon: I.users,
        children: AGENTES_LIST.map(a => ({
          href: `/agente/${a.slug}`,
          label: a.nombre.split(' ')[0],
          color: a.color,
        })),
      },
      { href: '/metas',             label: 'Esquema de metas', icon: I.scheme },
      { href: '/comparativo',       label: 'Comparativo',    icon: I.compare },
      {
        label: 'Configuración', icon: I.cog,
        children: [
          { href: '/admin',                  label: 'Carga de datos' },
          { href: '/admin/comisiones',       label: 'Tramos generales' },
          { href: '/admin/comisiones-luz',   label: 'Tramos Luz (SAE)' },
          { href: '/admin/usuarios',         label: 'Usuarios y accesos' },
        ],
      },
    ];
  }

  // JEFA
  return [
    { href: '/resumen',           label: 'Equipo',         icon: I.team },
    {
      label: 'Por asesora', icon: I.users,
      children: AGENTES_LIST.map(a => ({
        href: `/agente/${a.slug}`,
        label: a.nombre.split(' ')[0],
        color: a.color,
      })),
    },
    { href: '/metas',             label: 'Esquema de metas', icon: I.scheme },
    { href: '/comparativo',       label: 'Comparativo',    icon: I.compare },
  ];
}

export default function Sidebar({
  rol, display, generadoEn,
}: { rol: Rol; display: string; generadoEn?: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const [openMobile, setOpenMobile] = useState(false);
  const items = navForRol(rol);

  // Estado de cuáles "groups" están expandidos. Por defecto expandidos
  // si el path actual está dentro del grupo.
  const initialOpen: Record<string, boolean> = {};
  for (const it of items) {
    if (it.children) {
      initialOpen[it.label] = it.children.some(c => path === c.href || path.startsWith(c.href + '/'));
    }
  }
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function isActive(href: string): boolean {
    if (href === '/admin') return path === '/admin';
    return path === href || path.startsWith(href + '/');
  }

  return (
    <>
      {/* Hamburguesa móvil */}
      <button
        onClick={() => setOpenMobile(o => !o)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-lg bg-white border border-line shadow-card flex items-center justify-center"
        aria-label="Abrir menú"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/* Overlay móvil */}
      {openMobile && (
        <div className="lg:hidden fixed inset-0 bg-ink/40 z-40" onClick={() => setOpenMobile(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-[260px] bg-white border-r border-line z-50 flex flex-col transition-transform duration-200 ${
          openMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Marca */}
        <div className="px-5 pt-5 pb-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white font-display font-bold text-[20px]">
              B
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-aqua-500" aria-hidden />
            </div>
            <div>
              <div className="font-display font-semibold text-[15px] text-ink leading-none">
                BaldeCash · <span style={{ color: '#00A29B' }}>Rumbo</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted2 mt-1">Tu equipo, sus metas</div>
            </div>
          </Link>
        </div>

        <div className="border-t border-line" />

        {/* Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map(it => {
            if (it.children) {
              const isOpen = openGroups[it.label] ?? false;
              const anyChildActive = it.children.some(c => isActive(c.href));
              return (
                <div key={it.label}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups(g => ({ ...g, [it.label]: !g[it.label] }))}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                      anyChildActive ? 'text-ink' : 'text-ink2 hover:bg-bg/60'
                    }`}
                  >
                    <span className={anyChildActive ? 'text-blue-600' : 'text-muted2'}>{it.icon}</span>
                    <span className="flex-1 text-left">{it.label}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-muted2 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-0.5 mb-1.5 pl-4 border-l border-line space-y-0.5">
                      {it.children.map(c => {
                        const a = isActive(c.href);
                        return (
                          <Link
                            key={c.href}
                            href={c.href}
                            onClick={() => setOpenMobile(false)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] transition-colors ${
                              a
                                ? 'bg-blue-700 text-white font-semibold'
                                : 'text-ink2 hover:bg-bg/70 hover:text-ink'
                            }`}
                          >
                            {c.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />}
                            <span>{c.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const a = isActive(it.href!);
            return (
              <Link
                key={it.href}
                href={it.href!}
                onClick={() => setOpenMobile(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                  a
                    ? 'bg-aqua-100 text-blue-700 ring-1 ring-aqua-300'
                    : 'text-ink2 hover:bg-bg/60'
                }`}
              >
                <span className={a ? 'text-blue-700' : 'text-muted2'}>{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Última actualización */}
        {generadoEn && (
          <div className="px-5 py-3 border-t border-line text-[10.5px]">
            <div className="uppercase tracking-[0.12em] text-muted2 mb-0.5">Última actualización</div>
            <div className="text-ink2 font-medium tabular">{formatTimestamp(generadoEn)}</div>
          </div>
        )}

        {/* Usuario + logout */}
        <div className="px-5 py-4 border-t border-line">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-display font-bold text-[12px]">
              {(display || rol).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-ink truncate">{display}</div>
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted2">{rol}</div>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost w-full text-[12px] py-1.5">
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
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
