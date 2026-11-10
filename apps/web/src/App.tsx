import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { getHealth } from './api';

export function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="primary">
            Order Tracking Workbench
          </Typography>
          <Typography variant="h4" component="h1" gutterBottom>
            订单与物流工作台
          </Typography>
          <Typography color="text.secondary">阶段 0 · 项目准备</Typography>
        </Box>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Chip
                label="基础框架已就绪"
                color="primary"
                sx={{ alignSelf: 'flex-start' }}
              />
              <Typography variant="h6" component="h2">
                服务连接
              </Typography>
              {health.isFetching && (
                <LinearProgress aria-label="检查后端连接" />
              )}
              {health.isSuccess && (
                <Alert severity="success">后端健康检查通过</Alert>
              )}
              {health.isError && (
                <Alert severity="error">
                  无法连接后端，请确认 API 服务已启动。
                </Alert>
              )}
              <Button
                variant="outlined"
                disabled={health.isFetching}
                onClick={() => void health.refetch()}
                sx={{ alignSelf: 'flex-start' }}
              >
                重新检查
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <Alert severity="info">
          当前仅完成项目骨架。审核通过后将获取真实 SKU
          数据，订单和物流功能尚未实现。
        </Alert>
      </Stack>
    </Container>
  );
}
