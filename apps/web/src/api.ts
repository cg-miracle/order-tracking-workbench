import type { HealthResponse } from '@workbench/contracts';

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('后端服务暂时无法连接');
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    !('status' in data) ||
    data.status !== 'ok' ||
    !('service' in data) ||
    data.service !== 'order-tracking-workbench'
  ) {
    throw new Error('健康检查响应格式无效');
  }
  return { status: data.status, service: data.service };
}
