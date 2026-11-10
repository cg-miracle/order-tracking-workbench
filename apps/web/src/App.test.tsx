// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import type { OrderDetail, OrderSummary } from '@workbench/contracts';
import { App } from './App';
import { theme } from './theme';

const detail: OrderDetail = {
  id: 'ORDER-TEST',
  orderedAt: '2025-11-30',
  status: 'in_transit',
  recipient: {
    company: 'Example Company',
    name: 'Example Recipient',
    phone: '0400 000 000',
    email: 'example@example.com',
    address: {
      line1: 'Example Street',
      suburb: 'Ryde',
      state: 'NSW',
      postcode: '2111',
      country: 'AU',
    },
  },
  items: [
    {
      id: 'item-test',
      sku: 'SKU-TEST',
      quantity: 2,
      shipmentId: 'shipment-test',
      product: { sku: 'SKU-TEST', name: 'Example Product', rrpAud: '22.00' },
      status: 'valid',
      unitExGstAud: '20.00',
      subtotalExGstAud: '40.00',
    },
  ],
  shipments: [
    {
      id: 'shipment-test',
      orderId: 'ORDER-TEST',
      carrier: 'tnt',
      trackingNumber: 'TRACK-TEST',
    },
  ],
  issues: [],
  totals: {
    status: 'complete',
    currency: 'AUD',
    subtotalExGstAud: '40.00',
    gstAud: '4.00',
    totalAud: '44.00',
    shipping: {
      amountAud: '0.00',
      source: 'not_implemented',
      message: 'Shipping estimation is not implemented.',
    },
  },
};

const summary: OrderSummary = {
  id: detail.id,
  orderedAt: detail.orderedAt,
  status: detail.status,
  company: detail.recipient.company,
  recipientName: detail.recipient.name,
  itemCount: 1,
  shipmentCount: 1,
  totals: detail.totals,
};

function mockApi(order = detail, trackingFails = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/tracking')) {
        if (trackingFails) {
          throw new Error('offline');
        }

        return {
          ok: true,
          json: async () => ({
            orderId: order.id,
            shipments: order.shipments.map((shipment) => ({
              ...shipment,
              queryStatus: 'not_implemented',
              message: 'Carrier tracking integration is not implemented.',
              events: [],
              currentStatus: null,
              lastUpdatedAt: null,
            })),
          }),
        };
      }

      return {
        ok: true,
        json: async () =>
          url === '/api/orders' ? { orders: [summary] } : order,
      };
    }),
  );
}

function renderApp(path = '/') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  });

  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('列表可导航到订单详情并展示商品及收货信息', async () => {
  mockApi();
  renderApp();

  fireEvent.click(await screen.findByRole('link', { name: 'View order' }));

  expect(
    await screen.findByRole('heading', { name: 'ORDER-TEST' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Example Product')).toBeInTheDocument();
  expect(screen.getByText('Example Recipient')).toBeInTheDocument();
  expect(screen.getByText('Example Street')).toBeInTheDocument();
  expect(screen.getByText(/AUD.*44.00/)).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'Product image placeholder' }),
  ).toBeInTheDocument();
  expect(await screen.findByText(/Not implemented/)).toBeInTheDocument();
});

it('直接进入详情不依赖列表请求，物流失败不影响订单内容', async () => {
  mockApi(detail, true);
  renderApp('/orders/ORDER-TEST');

  expect(await screen.findByText('Example Product')).toBeInTheDocument();
  expect(
    await screen.findByText(/Tracking could not be loaded/),
  ).toBeInTheDocument();
  expect(screen.getByText(/AUD.*44.00/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalledWith('/api/orders', expect.anything());
});

it('请求等待期间显示加载状态', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  renderApp();

  expect(
    screen.getByRole('status', { name: 'Loading order data' }),
  ).toBeInTheDocument();
});

it('失败提示允许重试并恢复列表', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ ok: true, json: async () => ({ orders: [summary] }) });
  vi.stubGlobal('fetch', fetchMock);
  renderApp();

  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

  expect(
    await screen.findByRole('link', { name: 'View order' }),
  ).toBeInTheDocument();
});

it('空列表显示明确提示', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ orders: [] }) }),
  );
  renderApp();

  expect(await screen.findByText('No orders available.')).toBeInTheDocument();
});

it('未知订单提供返回列表链接', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  renderApp('/orders/missing');

  expect(await screen.findByText('Order not found.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to orders' })).toHaveAttribute(
    'href',
    '/',
  );
});

it('无效商品展示问题并隐藏无法计算的金额', async () => {
  const invalid = structuredClone(detail);
  invalid.issues = [
    {
      itemId: 'item-test',
      code: 'missing_product',
      message: 'Product could not be matched.',
    },
  ];
  invalid.items[0] = {
    ...invalid.items[0]!,
    status: 'invalid',
    product: null,
    unitExGstAud: null,
    subtotalExGstAud: null,
  };
  invalid.totals = {
    ...invalid.totals,
    status: 'incomplete',
    subtotalExGstAud: null,
    gstAud: null,
    totalAud: null,
  };

  mockApi(invalid);
  renderApp('/orders/ORDER-TEST');

  expect(await screen.findByText('Unmatched product')).toBeInTheDocument();
  expect(screen.getByText('Product could not be matched.')).toBeInTheDocument();
  expect(screen.getByText(/cannot be fully calculated/)).toBeInTheDocument();
  expect(screen.queryByText(/AUD.*44.00/)).not.toBeInTheDocument();
});

it('未知页面显示英文导航提示', () => {
  renderApp('/unknown');

  expect(
    screen.getByRole('heading', { name: 'Page not found' }),
  ).toBeInTheDocument();
});

it('展示承运商返回的状态、更新时间和事件，标明测试环境', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith('/tracking')
          ? {
              orderId: detail.id,
              shipments: [
                {
                  ...detail.shipments[0],
                  queryStatus: 'available',
                  currentStatus: 'Delivered in Full',
                  lastUpdatedAt: '2025-02-13T11:49:59+11:00',
                  message: 'Response from the carrier test environment.',
                  source: 'auspost-test',
                  events: [
                    {
                      description: 'Delivered at facility',
                      date: '2025-02-13T11:49:59+11:00',
                      location: 'Test location',
                    },
                  ],
                },
              ],
            }
          : detail,
    })),
  );
  renderApp('/orders/ORDER-TEST');

  expect(await screen.findByText(/Delivered in Full/)).toBeInTheDocument();
  expect(screen.getByText(/Last updated:/)).toHaveTextContent('13 Feb 2025');
  expect(screen.getByText(/Delivered at facility/)).toBeInTheDocument();
  expect(screen.getByText(/cached for up to 60 seconds/)).toBeInTheDocument();
});
