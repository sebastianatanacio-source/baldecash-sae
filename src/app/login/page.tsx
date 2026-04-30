import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  const params = await searchParams;
  if (session.rol) {
    if (session.rol === 'fernanda' || session.rol === 'stefania' || session.rol === 'julio' || session.rol === 'luz') {
      redirect(`/agente/${session.rol}`);
    }
    redirect(params.next ?? '/resumen');
  }

  return (
    <main className="min-h-screen flex flex-col bg-bg">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[440px]">
          {/* Marca */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl bg-blue-700 flex items-center justify-center text-white font-display font-bold text-2xl shadow-card">
              B
              <span className="absolute w-1.5 h-1.5 rounded-full bg-aqua-500 -mt-4 ml-4" />
            </div>
            <div>
              <div className="font-display font-semibold text-lg text-ink leading-none">BaldeCash</div>
              <div className="text-xs text-muted mt-1 tracking-wide">Equipo SAE — Atención al Estudiante</div>
            </div>
          </div>

          {/* Card */}
          <div className="card-surface p-8">
            <p className="eyebrow mb-3">Acceso restringido</p>
            <h1 className="font-display text-[34px] font-semibold leading-tight text-ink mb-2">
              Rumbo
            </h1>
            <p className="text-sm text-muted mb-7">
              Tu equipo, sus metas. Reporte ejecutivo, indicadores operativos y comisiones del equipo SAE.
            </p>
            <LoginForm next={params.next} />
          </div>

          <p className="text-[11px] text-muted2 mt-6 text-center">
            © {new Date().getFullYear()} BaldeCash · Uso interno
          </p>
        </div>
      </div>
    </main>
  );
}
