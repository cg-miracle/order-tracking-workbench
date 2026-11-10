// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderApp() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <App />
    </QueryClientProvider>,
  );
}

it('健康请求成功后显示真实连通状态', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'order-tracking-workbench' }),
    }),
  );
  renderApp();
  expect(await screen.findByText('后端健康检查通过')).toBeInTheDocument();
});

it('健康请求失败时提示用户并提供重试', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  renderApp();
  expect(
    await screen.findByText('无法连接后端，请确认 API 服务已启动。'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重新检查' })).toBeEnabled();
});
