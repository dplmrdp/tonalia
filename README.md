# Tonalia

App web para aprender a cantar. Subes una canción, separa la voz, marca sus notas en un piano-roll con solfeo y las reproduce como "La la la".

**App:** https://dplmrdp.github.io/tonalia

## Estructura

```
web/                 La app (se publica en GitHub Pages)
  index.html         Toda la app: interfaz, detección de tono (YIN) y piano-roll
  config.js          URL del servidor de separación (la escribe la Action al publicar)
  manifest.webmanifest, sw.js, icon.svg   Instalable en el móvil y usable sin conexión
worker/              Servidor de separación (Cloudflare Worker → Replicate/Demucs)
  worker.js
  wrangler.toml
.github/workflows/
  pages.yml          Publica web/ en cada cambio
  worker.yml         Despliega worker/ en cada cambio
```

## Puesta en marcha

### 1. Publicar la app

En *Settings → Pages → Build and deployment → Source*, elige **GitHub Actions**. Después lanza el workflow *Publicar app* desde la pestaña *Actions*, o haz cualquier cambio en `web/`.

Con esto la app ya funciona con los modos **Aproximada** y **Ya es solo voz**.

### 2. Separación con IA (opcional)

1. **Replicate**
   - Crea una cuenta en <https://replicate.com> y añade un método de pago. Cobra por uso.
   - Genera un token en *Account → API tokens*.
2. **Cloudflare**
   - Crea una cuenta gratuita en <https://dash.cloudflare.com>.
   - En *My Profile → API Tokens → Create Token*, usa la plantilla **Edit Cloudflare Workers**.
   - Apunta también tu **Account ID**, que aparece en la página de *Workers & Pages*.
3. **Secretos en GitHub.** Ve a *Settings → Secrets and variables → Actions → Secrets* y añade:
   - `REPLICATE_API_TOKEN`
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. **Desplegar el Worker.** Lanza el workflow *Desplegar servidor de separación*. Al terminar, el log muestra la URL del Worker, del tipo `https://tonalia-separador.<tu-subdominio>.workers.dev`.
5. **Conectar la app con el Worker.** En *Settings → Secrets and variables → Actions → Variables*, crea `WORKER_URL` con esa URL. Vuelve a lanzar *Publicar app*.

El modelo se configura en `worker/wrangler.toml`. Por defecto es `ryan5453/demucs`, en su última versión. Para fijar una versión concreta, añade `REPLICATE_MODEL_VERSION`.

## Probar en local

```
cd web && python3 -m http.server 8000
```

Abre http://localhost:8000. El micrófono y la instalación como app solo funcionan con HTTPS o desde localhost.

## Hoja de ruta

- [x] Subir canción, separar voz y marcar notas
- [ ] Modo práctica con micrófono (más agudo / más grave en tiempo real)
- [ ] Juego de repetir secuencias de notas
