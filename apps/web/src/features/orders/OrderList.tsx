import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router';
import {
  LoadingView,
  OrderStatus,
  Panel,
  RequestError,
} from '../../shared/components';
import { formatDate, formatMoney } from '../../shared/format';
import { useOrders } from './order-hooks';

export function OrderList() {
  const orders = useOrders();

  if (orders.isPending) {
    return <LoadingView />;
  }

  if (orders.isError) {
    return <RequestError retry={() => void orders.refetch()} />;
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Overview
        </Typography>
        <Typography variant="h4" component="h1" gutterBottom>
          Orders
        </Typography>
        <Typography color="text.secondary">
          Order details, delivery information and totals in one place.
        </Typography>
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography color="text.secondary">
          {orders.data.orders.length} orders
        </Typography>
        <Button
          onClick={() => void orders.refetch()}
          disabled={orders.isFetching}
        >
          Refresh orders
        </Button>
      </Stack>
      {orders.data.orders.length === 0 && (
        <Alert severity="info">No orders available.</Alert>
      )}
      {orders.data.orders.map((order) => (
        <Panel key={order.id} title={order.company}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
          >
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {order.id}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {formatDate(order.orderedAt)} · {order.recipientName} ·{' '}
                {order.itemCount} items · {order.shipmentCount} shipments
              </Typography>
              <Box>
                <OrderStatus status={order.status} />
              </Box>
            </Stack>
            <Stack
              spacing={1}
              alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
              sx={{ flexShrink: 0 }}
            >
              <Typography fontWeight={700}>
                {formatMoney(order.totals.totalAud)}
              </Typography>
              <Button
                component={Link}
                to={'/orders/' + encodeURIComponent(order.id)}
                variant="contained"
              >
                View order
              </Button>
            </Stack>
          </Stack>
        </Panel>
      ))}
    </Stack>
  );
}
