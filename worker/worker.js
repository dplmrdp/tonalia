// Tonalia · servidor de separación de voz (Cloudflare Worker)
// Hace de intermediario con Replicate para que la clave nunca llegue al navegador.
//
// Variables (Settings → Variables del Worker):
//   REPLICATE_API_TOKEN      (secreta) tu token de https://replicate.com/account/api-tokens
//   REPLICATE_MODEL          modelo de Replicate, p. ej. "ryan5453/demucs" (se usa su última versión)
//   REPLICATE_MODEL_VERSION  opcional: fija una versión concreta en vez de la última
//   AUDIO_INPUT_NAME         nombre del campo de audio del modelo (por defecto "audio")
//   EXTRA_INPUT              opcional, JSON con más parámetros del modelo, p. ej. {"stem":"vocals"}
//   ALLOWED_ORIGIN           opcional, origen permitido (p. ej. https://tonalia.pages.dev). Por defecto "*"
//
// Rutas:
//   POST /upload        multipart "file"        → { url }   (sube el audio a Replicate Files)
//   POST /separate      JSON { audio: url }     → predicción { id, status, ... }
//   GET  /status/:id                             → predicción { id, status, output, error }
//   GET  /audio?url=…   (solo replicate.delivery / api.replicate.com) → el audio con CORS

const API = 'https://api.replicate.com/v1';

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!env.REPLICATE_API_TOKEN) return json({ error: 'Falta REPLICATE_API_TOKEN en el servidor.' }, 500);

    const auth = { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}` };
    const url = new URL(req.url);

    try {
      if (url.pathname === '/upload' && req.method === 'POST') {
        const form = await req.formData();
        const file = form.get('file');
        if (!file || typeof file === 'string') return json({ error: 'No llegó ningún archivo.' }, 400);
        if (file.size > 100 * 1024 * 1024) return json({ error: 'El archivo supera 100 MB.' }, 413);
        const fd = new FormData();
        fd.append('content', file, file.name || 'audio');
        const r = await fetch(`${API}/files`, { method: 'POST', headers: auth, body: fd });
        const j = await r.json();
        if (!r.ok) return json({ error: j.detail || 'Replicate rechazó el archivo.' }, r.status);
        return json({ url: j.urls && j.urls.get });
      }

      if (url.pathname === '/separate' && req.method === 'POST') {
        const { audio } = await req.json();
        if (!audio) return json({ error: 'Falta el audio.' }, 400);
        let version = env.REPLICATE_MODEL_VERSION;
        if (!version) {
          if (!env.REPLICATE_MODEL) return json({ error: 'Falta REPLICATE_MODEL en el servidor.' }, 500);
          const m = await fetch(`${API}/models/${env.REPLICATE_MODEL}`, { headers: auth });
          const mj = await m.json();
          version = mj.latest_version && mj.latest_version.id;
          if (!version) return json({ error: 'No se encontró el modelo ' + env.REPLICATE_MODEL + ' en Replicate.' }, 502);
        }
        const extra = env.EXTRA_INPUT ? JSON.parse(env.EXTRA_INPUT) : {};
        const input = { ...extra, [env.AUDIO_INPUT_NAME || 'audio']: audio };
        const r = await fetch(`${API}/predictions`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ version, input }),
        });
        const j = await r.json();
        if (!r.ok) return json({ error: j.detail || 'Replicate no aceptó la petición.' }, r.status);
        return json(j);
      }

      if (url.pathname.startsWith('/status/') && req.method === 'GET') {
        const id = url.pathname.split('/').pop();
        if (!/^[a-z0-9]+$/i.test(id)) return json({ error: 'Id no válido.' }, 400);
        const r = await fetch(`${API}/predictions/${id}`, { headers: auth });
        const j = await r.json();
        return json({ id: j.id, status: j.status, output: j.output, error: j.error }, r.ok ? 200 : r.status);
      }

      if (url.pathname === '/audio' && req.method === 'GET') {
        const target = new URL(url.searchParams.get('url') || '');
        const okHost = target.hostname.endsWith('replicate.delivery') || target.hostname === 'api.replicate.com';
        if (target.protocol !== 'https:' || !okHost) return json({ error: 'Origen de audio no permitido.' }, 400);
        const r = await fetch(target, { headers: target.hostname === 'api.replicate.com' ? auth : {} });
        if (!r.ok) return json({ error: 'No se pudo descargar el audio separado.' }, r.status);
        return new Response(r.body, {
          headers: { ...cors, 'Content-Type': r.headers.get('Content-Type') || 'audio/mpeg' },
        });
      }

      return json({ error: 'Ruta no encontrada.' }, 404);
    } catch (e) {
      return json({ error: 'Error del servidor: ' + (e && e.message ? e.message : e) }, 500);
    }
  },
};
