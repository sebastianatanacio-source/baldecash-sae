import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { changePassword, verifyCredentials, type Rol } from '@/lib/auth/users';

const ROLES: Rol[] = ['admin', 'jefa', 'fernanda', 'stefania', 'julio'];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.rol) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  let body: { username?: string; nueva?: string; actual?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body inválido.' }, { status: 400 }); }

  const username = (body.username ?? '').trim() as Rol;
  const nueva = body.nueva ?? '';

  if (!ROLES.includes(username)) {
    return NextResponse.json({ error: 'Usuario no válido.' }, { status: 400 });
  }
  if (nueva.length < 6) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
  }

  // Reglas: admin puede cambiar a cualquiera. Otros solo la suya y deben enviar la actual.
  if (session.rol !== 'admin') {
    if (username !== session.rol) {
      return NextResponse.json({ error: 'Solo puedes cambiar tu propia contraseña.' }, { status: 403 });
    }
    const actual = body.actual ?? '';
    const ok = await verifyCredentials(username, actual);
    if (!ok) return NextResponse.json({ error: 'Contraseña actual incorrecta.' }, { status: 401 });
  }

  await changePassword(username, nueva);
  return NextResponse.json({ ok: true });
}
