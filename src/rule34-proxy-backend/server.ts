import fastify from 'fastify';
import cors from '@fastify/cors';

const server = fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: '*' });

  // ====================== ПОСТЫ ======================
  server.get('/api/posts', async (request, reply) => {
    const { limit = '15', pid = '0', tags = '' } = request.query as any;

    const total = Number(limit) || 15;
    const startPage = Number(pid) || 0;
    const userTags = String(tags).trim();

    const baseParams = {
      page: 'dapi',
      s: 'post',
      q: 'index',
      json: '1',
      limit: '100',
      user_id: '6083293',
      api_key: '335eb8b2d26006a378a4f68035f914eef2cfa8cffa669019d355d0d85ce211cd9a48f555bd378f1812b3bd11525eac159af1f3cd2d93828e032504f6dfb4d9cd',
    };

    // Если пользователь выбрал тег — ищем ТОЛЬКО по нему
    // Если ничего не ввёл — показываем animated (видео)
    const searchTags = userTags ? userTags : 'animated';

    function isVideo(post: any) {
      const url = String(post.file_url || '').toLowerCase();
      return url.endsWith('.mp4') || url.endsWith('.webm');
    }

    async function fetchPage(page: number) {
      const params = new URLSearchParams({
        ...baseParams,
        pid: String(page),
        tags: searchTags,
      });

      const res = await fetch(`https://api.rule34.xxx/index.php?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    try {
      let page = startPage;
      let collected: any[] = [];

      while (collected.length < total) {
        const batch = await fetchPage(page);
        if (batch.length === 0) break;

        const videos = batch.filter(isVideo);           // оставляем только видео
        collected = [...collected, ...videos];
        page++;
      }

      // Убираем дубли
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

  // ====================== ТЕГИ (ПОДСКАЗКИ) ======================
  server.get('/api/tags', async (request, reply) => {
    const { q = '' } = request.query as any;
    const query = String(q).trim();

    if (query.length < 2) return reply.send([]);

    const params = new URLSearchParams({
      page: 'dapi',
      s: 'tag',
      q: 'index',
      json: '1',
      limit: '10',
      name: query,
      user_id: '6083293',
      api_key: '335eb8b2d26006a378a4f68035f914eef2cfa8cffa669019d355d0d85ce211cd9a48f555bd378f1812b3bd11525eac159af1f3cd2d93828e032504f6dfb4d9cd',
    });

    try {
      const res = await fetch(`https://api.rule34.xxx/index.php?${params}`);
      if (!res.ok) return reply.send([]);

      const data: any[] = await res.json();
      const suggestions = data.map(tag => `${tag.name} (${tag.count})`);

      return reply.send(suggestions);
    } catch (e) {
      console.error(e);
      return reply.send([]);
    }
  });

  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.log('🚀 Сервер запущен: http://localhost:3001');
  console.log('   ✅ /api/posts');
  console.log('   ✅ /api/tags');
}

start().catch(console.error);