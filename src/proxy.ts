import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/auth/session';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/favicon.ico']);

/**
 * Lee la cookie de sesión sin pasar por la API de iron-session que requiere
 * cookies() de next/headers (no disponible en proxy). Hacemos unseal manual.
 */
async function readSession(req: NextRequest): Promise<SessionData> {
  const cookie = req.cookies.get(sessionOptions.cookieName)?.value;
  if (!cookie) return {};
  try {
    return await unsealData<SessionData>(cookie, { password: sessionOptions.password as string });
  } catch {
    return {};
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Recursos estáticos: dejar pasar
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/assets') ||
    PUBLIC_PATHS.has(pathname)
  ) return NextResponse.next();

  const session = await readSession(req);

  if (!session.rol) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Restricción por rol — asesoras solo ven su propio dashboard
  if (session.rol === 'fernanda' || session.rol === 'stefania' || session.rol === 'julio' || session.rol === 'luz') {
    const allowedPrefix = `/agente/${session.rol}`;
    const allowed =
      pathname === allowedPrefix ||
      pathname.startsWith(allowedPrefix + '/') ||
      pathname === '/' ||
      pathname.startsWith('/api/auth/') ||
      pathname.startsWith('/api/snapshot');
    if (!allowed) {
      const url = req.nextUrl.clone();
      url.pathname = `/agente/${session.rol}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
