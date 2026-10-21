# Ruta de ventas

Dashboard personal de ventas de Alejandro Lamont: la ruta del día (a pie, llamadas y DMs),
prospectos, embudo y guiones, separados por proyecto.

Proyectos iniciales:

- **Apps y webs**: lo que produce Luis Enrique (páginas web, micro apps, sistemas).
- **Mi proyecto**: proyecto propio, para completar.
- **Jabones artesanales**: venta en persona a tiendas y proveedores.

## Pantallas

| Pantalla | Para qué |
| --- | --- |
| Hoy | A quién contacto hoy y por qué medio. Vencidos, propuestas abiertas y lo cerrado en el mes. |
| Ruta | Armar el día por zona y canal, ordenar las visitas y abrir la ruta a pie en Google Maps. |
| Prospectos | Lista con búsqueda y filtros por rubro, zona y etapa. Cada ficha tiene historial y guiones. |
| Embudo | Prospectos por etapa; se arrastran o se avanzan con la flecha. |
| Proyectos | Crear y editar proyectos: qué se vende, precios, canales, rubros y meta mensual. |
| Guiones | Textos para llamadas, visitas, WhatsApp y DMs con `{negocio}`, `{contacto}`, `{rubro}`, `{zona}`, `{vendedor}`. |
| Ajustes | Nombre, ciudad para Maps, moneda, copia de seguridad y datos de ejemplo. |

## Bienvenida y seguridad

- La primera vez en cada dispositivo aparece una guía: PIN de 4 números, Face ID o huella,
  conectar la nube, empezar vacío o con ejemplos, e instalar en la pantalla de inicio.
- Después, cada vez que se abre la app (o se vuelve a ella tras 1 minuto; se cambia en Ajustes)
  pide Face ID o el PIN. Tras 5 intentos fallidos espera 30 segundos.
- El PIN y Face ID viven solo en ese dispositivo. Es una pantalla de bloqueo, no cifrado.
- **Ajustes → Seguridad**: cambiar o quitar el PIN, activar Face ID, bloquear ahora.
  **Ajustes → Bienvenida** vuelve a mostrar la guía.

## Gestos

- **Deslizar un pendiente a la derecha**: hecho (abre "¿Cómo te fue?").
- **Deslizar a la izquierda**: pasa a mañana. Sale un aviso con **Deshacer**.
- **Tocar el círculo**: marcar como hecho.
- **Arrastrar una hoja hacia abajo**: cerrarla.
- En el teléfono vibra al confirmar (Android). Si el teléfono tiene "Reducir movimiento", las animaciones se suavizan.

## Datos y nube

Cada dispositivo trabaja con su copia local, así que la app funciona sin señal. Con la nube activada,
cada cambio se sube unos segundos después y al abrir la app se baja lo último; si el teléfono y la
computadora cambian cosas a la vez, se unen registro por registro (gana el cambio más reciente y lo
borrado en uno se borra en el otro).

La nube es Upstash Redis (plan gratis) detrás de `/api/sync`, protegida con una clave.
Los prospectos de ejemplo usan teléfonos 555-01xx (ficticios) y se borran con un botón.

### Activar la nube (una vez)

1. En Vercel, abre el proyecto → **Storage** → **Create Database** → **Upstash for Redis** (plan Free)
   → conéctala al proyecto. Vercel agrega solo `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
2. **Settings → Environment Variables**: agrega `CLAVE_ACCESO` con una clave tuya.
3. **Deployments → Redeploy**.
4. En la app, **Ajustes → Nube**, escribe la clave. Repite el paso 4 en cada dispositivo.

## En el teléfono

Abre la app en el navegador y usa **Agregar a pantalla de inicio** (Safari: compartir → Agregar a
inicio; Chrome: menú → Instalar app). Se abre a pantalla completa con su ícono.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

Next.js 16, React 19, Tailwind CSS 4 y Zustand.

## Publicar en Vercel

1. Entra en https://vercel.com/new e importa el repositorio `ruta-de-ventas` desde GitHub.
2. Vercel detecta Next.js solo: no hace falta cambiar nada ni poner variables de entorno.
3. Pulsa **Deploy**. Cada push a `main` vuelve a publicar la app.
