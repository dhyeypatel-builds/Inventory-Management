import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAlerts, acknowledgeAlert } from '../api/alerts.api';
import type { ListAlertsParams } from '../types';

export const alertKeys = {
  all: ['alerts'] as const,
  list: (params: ListAlertsParams) => ['alerts', 'list', params] as const,
};

export function useAlerts(params: ListAlertsParams = {}) {
  return useQuery({
    queryKey: alertKeys.list(params),
    queryFn: () => listAlerts(params),
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: alertKeys.all }),
  });
}
