import type { FastifyInstance } from 'fastify';
import type { Dataset, TrackingResult } from '@workbench/contracts';
import { loadDataset } from './data.js';
import { calculateOrder, summarizeOrder } from './orders.js';

export async function registerOrderRoutes(
  app: FastifyInstance,
  provided?: Dataset,
) {
  const data = provided ?? (await loadDataset());
  const params = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1, maxLength: 128 } },
    additionalProperties: false,
  };

  app.get('/api/orders', async () => ({
    orders: data.orders.map((order) =>
      summarizeOrder(calculateOrder(order, data)),
    ),
  }));

  app.get<{ Params: { id: string } }>(
    '/api/orders/:id',
    { schema: { params } },
    async (request, reply) => {
      const order = data.orders.find((order) => order.id === request.params.id);

      if (!order) {
        return reply.code(404).send({ message: 'Order not found.' });
      }

      return calculateOrder(order, data);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/orders/:id/tracking',
    { schema: { params } },
    async (request, reply) => {
      const order = data.orders.find((order) => order.id === request.params.id);

      if (!order) {
        return reply.code(404).send({ message: 'Order not found.' });
      }

      const shipments: TrackingResult[] = data.shipments
        .filter((shipment) => shipment.orderId === order.id)
        .map((shipment) => ({
          ...shipment,
          queryStatus: 'not_implemented',
          message: 'Carrier tracking integration is not implemented.',
          currentStatus: null,
          lastUpdatedAt: null,
        }));

      return { orderId: order.id, shipments };
    },
  );
}
