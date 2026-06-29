# HTML Visor

Editor local de HTML, CSS y JavaScript con previsualizacion rapida en modo simple y soporte de proyectos en modo archivos.

## Uso local

Abre `index.html` directamente para uso simple. Para probar comportamiento de proyecto, service worker o rutas virtuales, sirve la carpeta por HTTP:

```powershell
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

## Build de produccion

Las fuentes editables son `src/app/*`, `styles.css` y `seo-pages.css`. Tras
modificarlas (o cambiar los iconos usados en la UI), regenera **todos** los
artefactos que sirve el sitio con un solo comando:

```powershell
node build.mjs
```

Esto ejecuta, en orden, la generacion, verificacion y versionado de recursos:

- `node build-app-bundle.mjs` — concatena `src/app/*` en `app.bundle.js`.
- `node build-lucide-subset.mjs` — genera `lucide.min.js` con solo los ~50
  iconos usados, extraidos de `vendor/lucide.full.min.js` (de 400 KB a ~13 KB).
  Si referencias un icono nuevo, el script falla si no existe: añadelo al uso y
  vuelve a construir.
- `node build-css.mjs` — minifica `styles.css`→`styles.min.css` y
  `seo-pages.css`→`seo-pages.min.css` (lo que sirve `index.html` y las paginas SEO).
- `node verify-runtime-assets.mjs` — comprueba que Monaco y las fuentes locales
  necesarias para arrancar sin CDNs estan completas.
- `node build-asset-versions.mjs` — añade hashes de contenido a las URLs de CSS
  y JS para impedir mezclas de cache entre despliegues.

## Archivos principales

- `index.html`: estructura de la aplicacion (carga los `.min` de produccion).
- `src/app/`: fuentes separadas por area para editar la logica del visor.
- `app.bundle.js`: bundle generado para reducir peticiones y parseo al arrancar.
- `vendor/`: copias fuente de Lucide y JSZip usadas durante el build; no se
  sirven directamente al cliente.
- `assets/vendor/monaco-editor/0.39.0/`: Monaco fijado y servido localmente.
- `assets/fonts/`: fuentes locales y sus licencias OFL.
- `lucide.min.js`, `styles.min.css`, `seo-pages.min.css`: artefactos generados
  por `build.mjs`; no los edites a mano.
- `preview-sw.js`: service worker para la previsualizacion de proyectos.
- `styles.css` y `layout.css`: estilos fuente (interfaz y layout inline).
