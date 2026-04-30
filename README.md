# BaldeCash · SAE

Plataforma interna de gestión, indicadores operativos y comisiones del equipo de Servicio de Atención Estudiantil (SAE) de BaldeCash.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 3.4** con la paleta corporativa BaldeCash
- **Chart.js** + `react-chartjs-2` para gráficas
- **iron-session** para autenticación con cookies firmadas
- **@vercel/blob** para persistencia (con fallback a archivo local en desarrollo)
- **xlsx** (SheetJS) y CSV parser propio para procesamiento server-side

## Roles

| Usuario | Rol | Acceso |
|---|---|---|
| `admin` | Administrador | Todas las vistas + carga de archivos + configuración del esquema + gestión de credenciales |
| `jefa` | Jefa SAE | Resumen · Comparativo · Metas (solo lectura) |
| `fernanda` · `stefania` · `julio` | Asesoras | Solo su dashboard personal |

Las contraseñas iniciales se toman de variables de entorno (ver `.env.local.example`). Una vez iniciada la app, se gestionan desde el panel de administración.

## Setup local

```bash
cp .env.local.example .env.local
# Edita .env.local — al menos cambia SESSION_SECRET por uno largo aleatorio.

npm install
npm run dev
# → http://localhost:3000
```

En desarrollo, sin `BLOB_READ_WRITE_TOKEN` configurado, el snapshot procesado se guarda en `data/snapshot.json` del propio repo (ignorado por git).

## Carga de datos

Inicia sesión como **admin**, ve a `Configuración` y sube los dos archivos:

- `AgentHistory_atencionbaldecash_*.csv` — exportado de **Blip** (`;` como separador, UTF-8 con BOM)
- `reporte_solicitudes_*.xlsx` — exportado del sistema **Admin** interno

El procesamiento se ejecuta server-side: el resultado se persiste y queda visible para todos los usuarios autorizados al instante.

### Reglas de atribución

```
si Cupón == cupón_propio:
    → atribuir a esa asesora (criterio primario)
si Cupón != cupón_propio AND Preowner == nombre_asesor:
    → atribuir a esa asesora (criterio secundario, sin doble conteo)

AE = Estado='aprobado' AND EstadoSolicitudAirtable='Entregada'
```

Cupones y nombres de Preowner se configuran en `src/lib/domain/agentes.ts`.

## Deployment en Vercel

1. Importa el repo en Vercel (`Add New Project`).
2. **Environment Variables** — añade las del archivo `.env.local.example`:
   - `SESSION_SECRET` (32+ chars aleatorios — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - Contraseñas iniciales de los 5 usuarios.
   - `BLOB_READ_WRITE_TOKEN` — créalo en *Storage → Blob → Create Store*.
3. Deploy. El primer login generará el archivo `users.json` automáticamente.

> **Nota:** sin `BLOB_READ_WRITE_TOKEN`, los snapshots se guardarían en disco efímero del serverless y se perderían entre deploys. Para producción es **obligatorio** configurarlo.

## Operación diaria

1. Cada mañana, el admin abre `/admin` y sube los dos archivos del día.
2. El procesamiento toma 2–8 segundos (24k+ filas Blip + 15k+ filas Admin).
3. Todas las vistas se actualizan automáticamente.

## Estructura

```
src/
  app/
    (panel)/        ← layout con header + nav, requiere sesión
      resumen/      ← Vista ejecutiva del equipo (admin / jefa)
      agente/[slug] ← Dashboard personal (asesora / admin / jefa)
      metas/        ← Pilares + simulador de comisión
      comparativo/  ← Esquema antiguo vs nuevo
      admin/        ← Carga de archivos + configuración + credenciales
    api/
      auth/         ← login · logout · password
      upload/       ← procesamiento server-side de los archivos
      snapshot/     ← lectura del último snapshot
      config/       ← lectura/escritura de tramos de comisión
    login/          ← Página de acceso
  lib/
    domain/         ← Tipos, agentes, comisiones, helpers
    parser/         ← Parsers CSV (Blip) y XLSX (Admin) — server-only
    auth/           ← iron-session + catálogo de usuarios
    storage/        ← Persistencia (Blob ↔ archivo local)
  components/
    ui/             ← Card, Kpi, Chips, EmptyState
    charts/         ← Bar, Line, Donut wrappers de Chart.js
    layout/         ← Header
  middleware.ts     ← Guard de auth + restricción por rol
```

## Métricas calculadas

| Métrica | Origen | Cálculo |
|---|---|---|
| `aten` | Blip | COUNT filas por agente y mes |
| `deja` | Blip | COUNT donde `Tags` contiene `"Deja solicitud"` |
| `pctDeja` | Blip | `deja / aten · 100` |
| `qtAvg`, `frtAvg`, `artAvg` | Blip | promedio simple, descartando outliers > 1000 min |
| `canales` | Blip | distribución por `Team` / `Canal` |
| `tags` | Blip | top-8 etiquetas de cierre |
| `sol` | Admin | COUNT con cupón propio |
| `aeCup` | Admin | COUNT AE con cupón propio |
| `aePre` | Admin | COUNT AE con preowner sin cupón propio |
| `aeTot` | Admin | `aeCup + aePre` |
| `pctSol` | Mixto | `sol / aten · 100` (proxy de productividad) |

## Comisiones

```
comisión_total = base × multiplicador_pilar1(aeTot) + bono_pilar2(pctSol)
```

Tramos por defecto (configurables vía `/admin`):

| Pilar 1 — AE del mes | Multiplicador |
|---|---|
| 1 – 29 | 1.0× |
| 30 – 44 | 1.25× |
| 45 – 59 | 1.5× |
| 60+ | 2.0× |

| Pilar 2 — % Sol/Aten | Bono |
|---|---|
| < 5% | S/ 0 |
| 5% – 7.9% | S/ 100 |
| 8% – 10.9% | S/ 300 |
| 11%+ | S/ 500 |

Esquema antiguo (referencia histórica): `aeCup × S/20 + aePre × S/12`.
