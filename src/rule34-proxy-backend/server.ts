import fastify from 'fastify';
import cors from '@fastify/cors';

const server = fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: '*' });

  server.get('/api/posts', async (request, reply) => {
    const { limit = '15', pid = '0', tags = '', onlyVideos = '0' } = request.query as any;

    const total = Number(limit) || 15;
    const startPage = Number(pid) || 0;
    const userTags = String(tags).trim();
    const videosOnly = onlyVideos === '1' || onlyVideos === 'true';

    const baseParams: Record<string, string> = {
      page: 'dapi',
      s: 'post',
      q: 'index',
      json: '1',
      limit: '100',
      user_id: '6083293',
      api_key:
        '335eb8b2d26006a378a4f68035f914eef2cfa8cffa669019d355d0d85ce211cd9a48f555bd378f1812b3bd11525eac159af1f3cd2d93828e032504f6dfb4d9cd',
    };

    function isVideo(post: any) {
      const url = String(post.file_url || '').toLowerCase();
      return url.endsWith('.mp4') || url.endsWith('.webm');
    }

    async function fetchPage(page: number) {
      const params = new URLSearchParams({
        ...baseParams,
        pid: String(page),
      });

      if (userTags) {
        params.set('tags', userTags);
      }

      const res = await fetch(`https://api.rule34.xxx/index.php?${params}`);
      if (!res.ok) return [];

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    try {
      let page = startPage;
      let collected: any[] = [];
      let attempts = 0;

      while (collected.length < total && attempts < 20) {
        attempts += 1;

        const batch = await fetchPage(page);
        if (batch.length === 0) break;

        const filtered = videosOnly ? batch.filter(isVideo) : batch;
        collected = [...collected, ...filtered];
        page += 1;
      }

      const seen = new Set<number>();
      const unique = collected.filter((p: any) => !seen.has(p.id) && seen.add(p.id));

      const shuffled = unique.sort(() => Math.random() - 0.5);
      const final = shuffled.slice(0, total);

      return reply.send(
        final.map((post: any) => ({
          id: post.id,
          file_url: post.file_url ?? null,
          sample_url: post.sample_url ?? null,
          preview_url: post.preview_url ?? null,
          width: post.width ?? null,
          height: post.height ?? null,
          preview_width: post.preview_width ?? null,
          preview_height: post.preview_height ?? null,
          score: post.score ?? 0,
          tags: post.tags ?? '',
        }))
      );
    } catch (e) {
      console.error('Ошибка /api/posts:', e);
      return reply.code(500).send({ error: 'API error' });
    }
  });

  server.get('/api/tags', async (request, reply) => {
    const { q = '' } = request.query as any;
    const query = String(q).trim();

    if (query.length < 2) return reply.send([]);

    try {
      const url = `https://api.rule34.xxx/autocomplete.php?q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) return reply.send([]);

      const data = await res.json();

      const normalized = Array.isArray(data)
        ? data
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object') {
                if (typeof item.label === 'string' && item.label.trim()) return item.label;
                if (typeof item.value === 'string' && item.value.trim()) return item.value;
              }
              return '';
            })
            .filter(Boolean)
        : [];

      return reply.send(normalized);
    } catch (e) {
      console.error('Ошибка /api/tags:', e);
      return reply.send([]);
    }
  });

  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.log('🚀 Сервер запущен');
}

start().catch(console.error);