import type {
  OrderDetail,
  OrderSummary,
  TrackingResult,
} from '@workbench/contracts';

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 404
        ? 'Order not found.'
        : 'Unable to load data. Please try again.',
    );
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path, { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return response.json();
}

export const getOrders = () => get<{ orders: OrderSummary[] }>('/api/orders');

export const getOrder = (id: string) =>
  get<OrderDetail>('/api/orders/' + encodeURIComponent(id));

export const getTracking = (id: string) =>
  get<{ orderId: string; shipments: TrackingResult[] }>(
    '/api/orders/' + encodeURIComponent(id) + '/tracking',
  );
