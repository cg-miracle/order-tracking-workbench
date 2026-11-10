import { useQuery } from '@tanstack/react-query';
import { getOrder, getOrders, getTracking } from './api';

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: getOrders });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: ['orders', id], queryFn: () => getOrder(id) });
}

export function useTracking(id: string) {
  return useQuery({
    queryKey: ['tracking', id],
    queryFn: () => getTracking(id),
    refetchOnWindowFocus: false,
  });
}
