// ============================================================
// Catálogo de usuarios y roles
// ============================================================
// Las contraseñas se leen primero de variables de entorno (init).
// Una vez que existe data/users.json (o el blob users.json), se usan ésas.

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export type Rol = 'admin' | 'jefa' | 'fernanda' | 'stefania' | 'julio' | 'luz';

export interface Usuario {
  username: Rol;
  rol: Rol;
  /** Hash sha256 hex */
  passHash: string;
  /** Salt hex */
  salt: string;
  /** Nombre humano para UI */
  display: string;
}

const KEY = 'users.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', KEY);
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const DEFAULT_DISPLAY: Record<Rol, string> = {
  admin: 'Administrador',
  jefa: 'Jefa SAE',
  fernanda: 'Fernanda Ferrer',
  stefania: 'Stefania Mc Gregor',
  julio: 'Julio Vargas',
  luz: 'Luz Rojas',
};

function hashPassword(pass: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + ':' + pass).digest('hex');
}

function makeUser(username: Rol, password: string): Usuario {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    username,
    rol: username,
    salt,
    passHash: hashPassword(password, salt),
    display: DEFAULT_DISPLAY[username],
  };
}

function defaultUsers(): Usuario[] {
  return ([
    ['admin',    process.env.ADMIN_PASSWORD    ?? 'admin2026'],
    ['jefa',     process.env.JEFA_PASSWORD     ?? 'jefa2026'],
    ['fernanda', process.env.FERNANDA_PASSWORD ?? 'ff2026'],
    ['stefania', process.env.STEFANIA_PASSWORD ?? 'sm2026'],
    ['julio',    process.env.JULIO_PASSWORD    ?? 'jl2026'],
    ['luz',      process.env.LUZ_PASSWORD      ?? 'lr2026'],
  ] as const).map(([u, p]) => makeUser(u, p));
}

/**
 * Garantiza que todos los roles del sistema estén presentes en la lista.
 * Si falta alguno (porque el JSON fue creado con una versión anterior),
 * se añade con la contraseña inicial sin tocar las contraseñas existentes.
 */
async function ensureAllRoles(users: Usuario[]): Promise<Usuario[]> {
  const todos = defaultUsers();
  const existentes = new Set(users.map(u => u.username));
  const faltantes = todos.filter(u => !existentes.has(u.username));
  if (faltantes.length === 0) return users;
  const merged = [...users, ...faltantes];
  await saveUsers(merged);
  return merged;
}

export async function loadUsers(): Promise<Usuario[]> {
  if (useBlob()) {
    try {
      const { list } = await import('@vercel/blob');
      const res = await list({ prefix: KEY, token: process.env.BLOB_READ_WRITE_TOKEN });
      const blob = res.blobs.find(b => b.pathname === KEY);
      if (!blob) {
        const u = defaultUsers();
        await saveUsers(u);
        return u;
      }
      const r = await fetch(blob.url, { cache: 'no-store' });
      if (!r.ok) return defaultUsers();
      const parsed = (await r.json()) as Usuario[];
      return await ensureAllRoles(parsed);
    } catch {
      return defaultUsers();
    }
  }
  try {
    const txt = await fs.readFile(LOCAL_PATH, 'utf-8');
    const parsed = JSON.parse(txt) as Usuario[];
    return await ensureAllRoles(parsed);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      const u = defaultUsers();
      await saveUsers(u);
      return u;
    }
    throw err;
  }
}

export async function saveUsers(users: Usuario[]): Promise<void> {
  const json = JSON.stringify(users, null, 2);
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    await put(KEY, json, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, json, 'utf-8');
}

export async function verifyCredentials(username: string, password: string): Promise<Usuario | null> {
  const users = await loadUsers();
  const u = users.find(x => x.username === username);
  if (!u) return null;
  const test = hashPassword(password, u.salt);
  // timing-safe compare
  const ok =
    test.length === u.passHash.length &&
    crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(u.passHash, 'hex'));
  return ok ? u : null;
}

export async function changePassword(username: Rol, newPassword: string): Promise<void> {
  const users = await loadUsers();
  const idx = users.findIndex(x => x.username === username);
  if (idx === -1) throw new Error(`Usuario "${username}" no existe.`);
  // Mantenemos el display existente al regenerar hash
  const display = users[idx].display;
  users[idx] = { ...makeUser(username, newPassword), display };
  await saveUsers(users);
}

export async function changeDisplayName(username: Rol, display: string): Promise<void> {
  const trimmed = display.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    throw new Error('El nombre debe tener entre 2 y 60 caracteres.');
  }
  const users = await loadUsers();
  const idx = users.findIndex(x => x.username === username);
  if (idx === -1) throw new Error(`Usuario "${username}" no existe.`);
  users[idx] = { ...users[idx], display: trimmed };
  await saveUsers(users);
}

/** Determina si un rol puede ver al agente especificado. */
export function puedeVerAgente(rol: Rol, agente: 'fernanda' | 'stefania' | 'julio' | 'luz'): boolean {
  if (rol === 'admin' || rol === 'jefa') return true;
  return rol === agente;
}
