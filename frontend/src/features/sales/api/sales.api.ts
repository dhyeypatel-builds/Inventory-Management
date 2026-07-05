import { api } from '@/shared/api/client';
import type {
  VariantSearchResponse,
  SaleDetail,
  SaleListResponse,
  CreateSalePayload,
  Customer,
  CustomerListResponse,
} from '../types';

// ─── Variant search (for POS item picker) ────────────────────────────────────

export interface SearchVariantsParams {
  q?: string;
  size?: string;
  inStock?: boolean;
  page?: number;
  pageSize?: number;
}

export async function searchVariants(
  params: SearchVariantsParams = {},
): Promise<VariantSearchResponse> {
  const res = await api.get('/variants', { params: { ...params, inStock: params.inStock ?? true } });
  return { variants: res.data.data, meta: res.data.meta } as VariantSearchResponse;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export interface ListSalesParams {
  customerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function createSale(
  payload: CreateSalePayload,
  idempotencyKey: string,
): Promise<SaleDetail> {
  const res = await api.post('/sales', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return res.data.data as SaleDetail;
}

export async function getSale(id: string): Promise<SaleDetail> {
  const res = await api.get(`/sales/${id}`);
  return res.data.data as SaleDetail;
}

export async function listSales(params: ListSalesParams = {}): Promise<SaleListResponse> {
  const res = await api.get('/sales', { params });
  return { items: res.data.data, meta: res.data.meta } as SaleListResponse;
}

export async function getSaleInvoice(id: string): Promise<SaleDetail> {
  const res = await api.get(`/sales/${id}/invoice`);
  return res.data.data as SaleDetail;
}

export async function cancelSale(id: string): Promise<SaleDetail> {
  const res = await api.post(`/sales/${id}/cancel`);
  return res.data.data as SaleDetail;
}

/** Emails the sale's branded invoice PDF to an address. */
export async function emailInvoice(
  id: string,
  email: string,
): Promise<{ email: string; invoiceNo: string }> {
  const res = await api.post(`/sales/${id}/invoice/email`, { email });
  return res.data.data as { email: string; invoiceNo: string };
}

// ─── Customers (for CustomerPicker) ──────────────────────────────────────────

export async function searchCustomers(q: string): Promise<CustomerListResponse> {
  const res = await api.get('/customers', { params: { q, pageSize: 20 } });
  return { customers: res.data.data, meta: res.data.meta } as CustomerListResponse;
}

/** Saves a customer (e.g. converting a walk-in after a sale completes). */
export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
}): Promise<Customer> {
  const res = await api.post('/customers', data);
  return res.data.data as Customer;
}
