import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyCredentials } from '@/lib/auth/users';

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }); }

  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  if (!username || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña requeridos.' }, { status: 400 });
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    // Pequeño delay para mitigar fuerza bruta
    await new Promise(r => setTimeout(r, 350));
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }

  const session = await getSession();
  session.rol = user.rol;
  session.display = user.display;
  session.loggedAt = Date.now();
  await session.save();

  return NextResponse.json({ ok: true, rol: user.rol, display: user.display });
}
