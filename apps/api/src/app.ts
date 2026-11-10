import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HealthResponse } from '@workbench/contracts';

export function buildApp() {
  const app = Fastify({
    logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] },
  });

  app.get('/api/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'order-tracking-workbench',
  }));

  const webRoot = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  if (existsSync(webRoot)) {
    app.register(fastifyStatic, { root: webRoot });
    app.setNotFoundHandler((request, reply) => {
      const pathname = request.url.split('?')[0] ?? '/';
      if (
        pathname === '/api' ||
        pathname.startsWith('/api/') ||
        pathname.startsWith('/assets/') ||
        !['GET', 'HEAD'].includes(request.method)
      ) {
        return reply.code(404).send({ message: '资源不存在' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
