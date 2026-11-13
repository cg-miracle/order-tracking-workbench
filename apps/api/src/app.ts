import type { Dataset } from '@workbench/contracts';
import { registerOrderRoutes } from './orders/order-routes.js';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HealthResponse } from '@workbench/contracts';

export function buildApp(data?: Dataset) {
  const app = Fastify({
    logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] },
  });

  app.get('/api/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'order-tracking-workbench',
  }));

  app.register(async (instance) => {
    await registerOrderRoutes(instance, data);
  });
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
        return reply.code(404).send({ message: 'Resource not found.' });
      }

      return reply.sendFile('index.html');
    });
  }

  return app;
}
