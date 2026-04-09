import fastify from 'fastify';
import cors from '@fastify/cors';

const server = fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: '*' });

  // API постов
  server.get('/api/posts', async (request, reply) => {
    const { limit = 50, pid = 0 } = request.query as any;

    const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=${limit}&pid=${pid}&user_id=6083293&api_key=335eb8b2d26006a378a4f68035f914eef2cfa8cffa669019d355d0d85ce211cd9a48f555bd378f1812b3bd11525eac159af1f3cd2d93828e032504f6dfb4d9cd`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      return data.map((post: any) => ({
        id: post.id,
        preview_url: post.preview_url, // главное
        sample_url: post.sample_url,
        file_url: post.file_url,
        width: post.width,
        height: post.height,
      }));
    } catch (e) {
      console.error(e);
      return reply.code(500).send({ error: 'API error' });
    }
  });

  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.log('🚀 http://localhost:3001/api/posts');
}

start();