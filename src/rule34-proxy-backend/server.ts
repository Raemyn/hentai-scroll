import fastify from 'fastify';
import cors from '@fastify/cors';

const server = fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: '*' });

  server.get('/api/posts', async (request, reply) => {
    const { limit = '30', pid = '0', tags = '' } = request.query as {
      limit?: string;
      pid?: string;
      tags?: string;
    };

    try {
      const params = new URLSearchParams({
        page: 'dapi',
        s: 'post',
        q: 'index',
        json: '1',
        limit,
        pid,
        user_id: '6083293',
        api_key: '335eb8b2d26006a378a4f68035f914eef2cfa8cffa669019d355d0d85ce211cd9a48f555bd378f1812b3bd11525eac159af1f3cd2d93828e032504f6dfb4d9cd',
      });

      if (tags.trim()) {
        params.set('tags', tags.trim());
      }

      const url = `https://api.rule34.xxx/index.php?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        return reply.code(502).send({ error: 'Upstream API error' });
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      return list.map((post: any) => ({
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
      }));
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send({ error: 'API error' });
    }
  });

  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.log('🚀 http://localhost:3001/api/posts');
}

start();