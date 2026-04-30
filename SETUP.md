# Cómo arrancar el proyecto

## ⚠️ Mover fuera de Google Drive antes del primer `npm install`

Google Drive sincroniza el contenido de la carpeta en paralelo y bloquea archivos
mientras npm los está instalando, lo que produce errores `EBADF` y `ENOTEMPTY`
al instalar Next.js. El proyecto **debe** estar en un disco local (no sincronizado)
para desarrollar.

### Opción 1 — Mover una sola vez (recomendado)

```powershell
# Desde PowerShell o cmd:
mkdir C:\dev
move "G:\Mi unidad\Proyecto_Consuelo\baldecash-sae" "C:\dev\baldecash-sae"
cd C:\dev\baldecash-sae
```

A partir de aquí, todo el desarrollo se hace en `C:\dev\baldecash-sae`. Cuando
quieras subirlo a GitHub para conectarlo a Vercel, lo haces directamente desde
ahí (no necesita estar dentro de Google Drive).

### Opción 2 — Pausar Google Drive durante la instalación

1. Click derecho en el ícono de Google Drive en la barra del sistema → **Pausar
   sincronización**.
2. Corre `npm install` y deja que termine.
3. Reanuda la sincronización.

> Esta opción es frágil: cualquier `npm install` futuro vuelve a fallar si Drive
> está activo en el momento. Recomiendo la Opción 1.

---

## Setup inicial (una sola vez)

```bash
cp .env.local.example .env.local

# Genera un SESSION_SECRET seguro (32+ caracteres):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → pega el resultado en .env.local

npm install
npm run dev
# → http://localhost:3000
```

Login inicial: `admin` / `admin2026` (luego se cambia desde el panel).

---

## Subir a Vercel

1. **Inicia un repo en GitHub** y haz push del proyecto (sin `node_modules` ni `.env*`).
   ```bash
   cd C:\dev\baldecash-sae
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/baldecash-sae.git
   git push -u origin main
   ```

2. **Importa el repo en Vercel** (`Add New Project` → selecciona el repo).

3. **Variables de entorno** (en Vercel → Project → Settings → Environment Variables):
   - `SESSION_SECRET` — el mismo valor largo aleatorio que en `.env.local`.
   - `ADMIN_PASSWORD`, `JEFA_PASSWORD`, `FERNANDA_PASSWORD`, `STEFANIA_PASSWORD`, `JULIO_PASSWORD`.
   - `BLOB_READ_WRITE_TOKEN` — créalo en *Storage → Blob → Create Store*. **Obligatorio en producción** para que los snapshots no se pierdan entre deploys.

4. **Deploy.**

---

## Operación diaria

1. El admin abre `https://<tu-dominio>.vercel.app/admin`.
2. Sube los dos archivos del día:
   - `AgentHistory_atencionbaldecash_DD-MM-YYYY_*.csv`
   - `reporte_solicitudes_*.xlsx`
3. La plataforma procesa todo en 2–8 segundos y todas las vistas quedan
   actualizadas para los demás usuarios.
