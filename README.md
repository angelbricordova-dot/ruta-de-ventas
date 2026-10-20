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

## Datos

Por ahora todo se guarda en el navegador (localStorage). Cada dispositivo tiene sus propios datos;
desde **Ajustes** se descarga y restaura una copia en JSON. Los prospectos de ejemplo usan teléfonos
555-01xx (ficticios) y se borran con un botón.

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
