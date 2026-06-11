import { api } from '@/shared/api/client';
import type {
  Vendor,
  CreatePurchasePayload,
  PurchaseDetail,
  PurchaseListResponse,
  SerialLookup,
} from '../types';

// ─── Vendors ─────────────────────────────────────────────────────────────────

export async function searchVendors(q: string): Promise<Vendor[]> {
  const res = await api.get('/vendors', { params: { q, pageSize: 20 } });
  return res.data.data as Vendor[];
}

export interface VendorListResponse {
  items: Vendor[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listVendors(params: { q?: string; page?: number; pageSize?: number } = {}): Promise<VendorListResponse> {
  const res = await api.get('/vendors', { params });
  return { items: res.data.data, meta: res.data.meta } as VendorListResponse;
}

export async function updateVendor(
  id: string,
  data: Partial<Pick<Vendor, 'name' | 'phone' | 'email' | 'vatNumber' | 'address' | 'notes'>>,
): Promise<Vendor> {
  const res = await api.patch(`/vendors/${id}`, data);
  return res.data.data as Vendor;
}

// ─── Purchases ───────────────────────────────────────────────────────────────

export interface ListPurchasesParams {
  q?: string;
  vendorId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function createPurchase(payload: CreatePurchasePayload): Promise<PurchaseDetail> {
  const res = await api.post('/purchases', payload);
  return res.data.data as PurchaseDetail;
}

export async function listPurchases(
  params: ListPurchasesParams = {},
): Promise<PurchaseListResponse> {
  const res = await api.get('/purchases', { params });
  return { items: res.data.data, meta: res.data.meta } as PurchaseListResponse;
}

export async function getPurchase(id: string): Promise<PurchaseDetail> {
  const res = await api.get(`/purchases/${id}`);
  return res.data.data as PurchaseDetail;
}

// ─── Serials ─────────────────────────────────────────────────────────────────

export async function lookupSerial(serialNo: string): Promise<SerialLookup> {
  const res = await api.get(`/serials/${encodeURIComponent(serialNo)}`);
  return res.data.data as SerialLookup;
}
