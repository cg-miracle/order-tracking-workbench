import { ShipmentTracking } from './ShipmentTracking';
import type { OrderDetail as Detail, OrderTotals } from '@workbench/contracts';
import {
  Alert,
  Box,
  Button,
  Divider,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link, useParams } from 'react-router';
import { ApiError } from './api';
import {
  LoadingView,
  OrderStatus,
  Panel,
  ProductPlaceholder,
  RequestError,
} from './components';
import { formatDate, formatMoney } from './format';
import { useOrder, useTracking } from './order-hooks';

function Summary({ totals }: { totals: OrderTotals }) {
  const rows = [
    ['Subtotal (excl. GST)', totals.subtotalExGstAud],
    ['GST (10%)', totals.gstAud],
    ['Shipping', totals.shipping.amountAud],
  ] as const;

  return (
    <Panel title="Order summary">
      <Stack spacing={2}>
        {totals.status === 'incomplete' && (
          <Alert severity="warning">
            This order cannot be fully calculated. Review the item issues.
          </Alert>
        )}
        {rows.map(([label, amount]) => (
          <Stack
            key={label}
            direction="row"
            justifyContent="space-between"
            spacing={2}
          >
            <Typography color="text.secondary">{label}</Typography>
            <Typography>{formatMoney(amount)}</Typography>
          </Stack>
        ))}
        <Typography variant="caption" color="text.secondary">
          {totals.shipping.message} Zero is not a carrier quote.
        </Typography>
        <Divider />
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Typography fontWeight={700}>Total</Typography>
          <Typography fontWeight={700} color="primary">
            {formatMoney(totals.totalAud)}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          All amounts in AUD. Line subtotals are rounded before GST is
          calculated.
        </Typography>
      </Stack>
    </Panel>
  );
}

function Items({ order }: { order: Detail }) {
  return (
    <Panel title="Order items">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: { xs: 'block', md: 'none' }, mb: 1 }}
      >
        Swipe the table horizontally to view quantities and prices.
      </Typography>
      <TableContainer
        role="region"
        aria-label="Order items table, scroll horizontally for all prices"
        tabIndex={0}
      >
        <Table size="small" sx={{ minWidth: 740 }}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">
                RRP
                <br />
                (incl. GST)
              </TableCell>
              <TableCell align="right">
                Unit
                <br />
                (excl. GST)
              </TableCell>
              <TableCell align="right">
                Subtotal
                <br />
                (excl. GST)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id} sx={{ verticalAlign: 'top' }}>
                <TableCell sx={{ py: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <ProductPlaceholder />
                    <Stack spacing={0.5}>
                      <Typography variant="body2" fontWeight={600}>
                        {item.product?.name ?? 'Unmatched product'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.sku}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Shipment:{' '}
                        {order.shipments.find(
                          (shipment) => shipment.id === item.shipmentId,
                        )?.trackingNumber ?? 'Unavailable'}
                      </Typography>
                      {order.issues
                        .filter((issue) => issue.itemId === item.id)
                        .map((issue) => (
                          <Typography
                            key={issue.code}
                            variant="caption"
                            color="error"
                          >
                            {issue.message}
                          </Typography>
                        ))}
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ py: 2 }}>
                  {item.quantity ?? 'Invalid'}
                </TableCell>
                <TableCell align="right" sx={{ py: 2, whiteSpace: 'nowrap' }}>
                  {formatMoney(
                    item.product &&
                      !order.issues.some(
                        (issue) =>
                          issue.itemId === item.id &&
                          issue.code === 'invalid_price',
                      )
                      ? item.product.rrpAud
                      : null,
                  )}
                </TableCell>
                <TableCell align="right" sx={{ py: 2, whiteSpace: 'nowrap' }}>
                  {formatMoney(item.unitExGstAud)}
                </TableCell>
                <TableCell align="right" sx={{ py: 2, whiteSpace: 'nowrap' }}>
                  {formatMoney(item.subtotalExGstAud)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 2 }}
      >
        Product images are placeholders. Displayed unit prices are rounded; line
        subtotals use the unrounded unit price.
      </Typography>
    </Panel>
  );
}

function Delivery({ order }: { order: Detail }) {
  const { recipient } = order;
  const { address } = recipient;

  return (
    <Panel title="Ship to">
      <Stack spacing={0.5} sx={{ overflowWrap: 'anywhere' }}>
        <Typography fontWeight={600}>{recipient.name}</Typography>
        <Typography>{recipient.company}</Typography>
        <Typography>{address.line1}</Typography>
        <Typography>
          {address.suburb} {address.state} {address.postcode}
        </Typography>
        <Typography>Australia</Typography>
        <MuiLink href={'tel:' + recipient.phone.replaceAll(' ', '')}>
          {recipient.phone}
        </MuiLink>
        <MuiLink href={'mailto:' + recipient.email}>{recipient.email}</MuiLink>
      </Stack>
    </Panel>
  );
}

function Tracking({ order }: { order: Detail }) {
  const tracking = useTracking(order.id);

  return (
    <Panel title="Shipments">
      <Stack spacing={2}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Typography variant="body2" color="text.secondary">
            {order.shipments.length} shipments
          </Typography>
          <Button
            size="small"
            disabled={tracking.isFetching}
            onClick={() => void tracking.refetch()}
          >
            Refresh tracking
          </Button>
        </Stack>
        {tracking.isPending && (
          <Typography role="status">Loading tracking information…</Typography>
        )}
        {tracking.isFetching && !tracking.isPending && (
          <Typography role="status">
            Refreshing tracking information…
          </Typography>
        )}
        {tracking.isError && (
          <Alert severity="warning">
            Tracking could not be loaded. Order details are still available.
          </Alert>
        )}
        {order.shipments.map((shipment) => {
          const result = tracking.data?.shipments.find(
            (entry) => entry.id === shipment.id,
          );

          return (
            <ShipmentTracking
              key={shipment.id}
              shipment={shipment}
              result={result}
            />
          );
        })}
        <Typography variant="caption" color="text.secondary">
          Order status is provided by the order source and is separate from
          carrier tracking.
        </Typography>
      </Stack>
    </Panel>
  );
}

export function OrderDetail() {
  const { id = '' } = useParams();
  const query = useOrder(id);

  if (query.isPending) {
    return <LoadingView />;
  }

  if (query.isError) {
    return (
      <RequestError
        notFound={query.error instanceof ApiError && query.error.status === 404}
        retry={() => void query.refetch()}
      />
    );
  }

  const order = query.data;

  return (
    <Stack spacing={3}>
      <Box>
        <Button component={Link} to="/">
          ← All orders
        </Button>
      </Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">
            Order details
          </Typography>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              overflowWrap: 'anywhere',
              fontSize: { xs: '1.5rem', md: '2rem' },
            }}
          >
            {order.id}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {formatDate(order.orderedAt)} · {order.recipient.company}
          </Typography>
        </Box>
        <Box>
          <OrderStatus status={order.status} />
        </Box>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Items order={order} />
          <Tracking key={order.id} order={order} />
        </Stack>
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Summary totals={order.totals} />
          <Delivery order={order} />
        </Stack>
      </Box>
    </Stack>
  );
}
