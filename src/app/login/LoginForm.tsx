'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Error al iniciar sesión.');
        setLoading(false);
        return;
      }
      // Redirección según rol
      if (data.rol === 'fernanda' || data.rol === 'stefania' || data.rol === 'julio' || data.rol === 'luz') {
        router.push(`/agente/${data.rol}`);
      } else {
        router.push(next ?? '/resumen');
      }
      router.refresh();
    } catch {
      setError('No se pudo contactar al servidor.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="eyebrow block mb-2">Usuario</label>
        <input
          type="text"
          autoComplete="username"
          autoFocus
          className="input-field"
          placeholder="admin · jefa · fernanda · stefania · julio"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="eyebrow block mb-2">Contraseña</label>
        <input
          type="password"
          autoComplete="current-password"
          className="input-field"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="text-[13px] text-gold-700 bg-gold-100 border border-gold-300 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Verificando…' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
