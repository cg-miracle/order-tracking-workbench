import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { Link, Route, Routes } from 'react-router';
import { OrderDetail } from '../features/orders/OrderDetail';
import { OrderList } from '../features/orders/OrderList';

export function App() {
  return (
    <>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography
            component={Link}
            to="/"
            variant="h6"
            color="inherit"
            sx={{
              textDecoration: 'none',
              flexGrow: 1,
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
          >
            Order Tracking Workbench
          </Typography>
          <Typography variant="caption" sx={{ flexShrink: 0 }}>
            AUD · Australia
          </Typography>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Routes>
          <Route path="/" element={<OrderList />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route
            path="*"
            element={
              <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                  Page not found
                </Typography>
                <Box>
                  <Button component={Link} to="/">
                    Back to orders
                  </Button>
                </Box>
              </Stack>
            }
          />
        </Routes>
      </Container>
    </>
  );
}
