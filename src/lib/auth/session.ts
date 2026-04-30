// ============================================================
// Sesión basada en cookies firmadas (iron-session)
// ============================================================

import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import type { Rol } from './users';

export interface SessionData {
  rol?: Rol;
  display?: string;
  loggedAt?: number;
}

/** Alias: `Session` incluye `save()`/`destroy()` provistos por iron-session. */
export type Session = IronSession<SessionData>;

export const sessionOptions: SessionOptions = {
  cookieName: 'baldecash-sae-session',
  password: process.env.SESSION_SECRET ?? 'desarrollo_secreto_no_usar_en_produccion_minimo_32_chars',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12, // 12h
  },
};

export async function getSession(): Promise<Session> {
  const c = await cookies();
  return await getIronSession<SessionData>(c, sessionOptions);
}

export async function requireSession(): Promise<Session & { rol: Rol }> {
  const s = await getSession();
  if (!s.rol) {
    // Lanzamos para que el caller redirija (en server components / route handlers)
    throw new Response(null, { status: 401, headers: { Location: '/login' } });
  }
  return s as Session & { rol: Rol };
}
