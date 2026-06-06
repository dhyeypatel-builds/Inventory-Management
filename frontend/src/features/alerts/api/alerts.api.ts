import { api } from '@/shared/api/client';
import type { AlertItem, AlertListResponse, ListAlertsParams } from '../types';

export async function listAlerts(params: ListAlertsParams = {}): Promise<AlertListResponse> {
  const res = await api.get('/alerts', { params });
  return { items: res.data.data, meta: res.data.meta } as AlertListResponse;
}

export async function acknowledgeAlert(id: string): Promise<AlertItem> {
  const res = await api.post(`/alerts/${id}/acknowledge`);
  return res.data.data as AlertItem;
}
