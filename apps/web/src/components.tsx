import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Link } from 'react-router';
import { statusLabel } from './format';

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent
        sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}
      >
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

export function OrderStatus({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={statusLabel(status)}
      color={status === 'completed' ? 'success' : 'primary'}
    />
  );
}

export function LoadingView() {
  return (
    <Stack spacing={2} role="status" aria-label="Loading order data">
      <Skeleton variant="rounded" height={96} />
      <Skeleton variant="rounded" height={240} />
    </Stack>
  );
}

export function RequestError({
  notFound = false,
  retry,
}: {
  notFound?: boolean;
  retry: () => void;
}) {
  return (
    <Alert severity={notFound ? 'info' : 'error'}>
      <Stack spacing={1} alignItems="flex-start">
        <Typography>
          {notFound
            ? 'Order not found.'
            : 'Unable to load data. Check the connection and try again.'}
        </Typography>
        {notFound ? (
          <Button component={Link} to="/">
            Back to orders
          </Button>
        ) : (
          <Button onClick={retry}>Try again</Button>
        )}
      </Stack>
    </Alert>
  );
}

export function ProductPlaceholder() {
  return (
    <Box
      role="img"
      aria-label="Product image placeholder"
      sx={{
        width: 48,
        height: 56,
        flexShrink: 0,
        borderRadius: 2,
        bgcolor: 'action.hover',
        display: 'grid',
        placeItems: 'center',
        color: 'primary.main',
      }}
    >
      <svg
        width="24"
        height="34"
        viewBox="0 0 24 34"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="7"
          y="1"
          width="10"
          height="6"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="3"
          y="7"
          width="18"
          height="25"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M4 16h16M4 24h16M12 18v4M10 20h4"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    </Box>
  );
}
