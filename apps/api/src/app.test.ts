import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('基础服务', () => {
  it('健康检查返回约定响应', async () => {
    const app = buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        service: 'order-tracking-workbench',
      });
    } finally {
      await app.close();
    }
  });

  it('未知 API 返回 404 而不是前端页面', async () => {
    const app = buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/missing' });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
