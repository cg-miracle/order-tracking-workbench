import { config } from 'dotenv';
import { buildApp } from './app.js';

config({ path: new URL('../../../.env', import.meta.url) });

const app = buildApp();
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT 必须是 1 到 65535 的整数');
}
try {
  await app.listen({ port, host: process.env.HOST || '127.0.0.1' });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}
