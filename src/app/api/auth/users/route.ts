import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { changeDisplayName, loadUsers, type Rol } from '@/lib/auth/users';

const ROLES: Rol[] = ['admin', 'jefa', 'fernanda', 'stefania', 'julio', 'luz'];

export const dynamic = 'force-dynamic';

/** GET — lista de usuarios (sin hash) para que el admin vea/edite. */
export async function GET() {
  const session = await getSession();
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  const users = await loadUsers();
  return NextResponse.json({
    users: users.map(u => ({ username: u.username, rol: u.rol, display: u.display })),
  });
}

/** PATCH — actualizar el display de un usuario. */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Solo el admin puede renombrar usuarios.' }, { status: 403 });

  let body: { username?: string; display?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body inválido.' }, { status: 400 }); }

  const username = (body.username ?? '').trim() as Rol;
  const display = (body.display ?? '').trim();

  if (!ROLES.includes(username)) {
    return NextResponse.json({ error: 'Usuario no válido.' }, { status: 400 });
  }
  try {
    await changeDisplayName(username, display);
    return NextResponse.json({ ok: true, username, display });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error al renombrar.' }, { status: 400 });
  }
}
