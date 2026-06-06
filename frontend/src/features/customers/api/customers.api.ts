import { api } from '@/shared/api/client';
import type {
  Customer,
  CustomerDetail,
  CustomerListResponse,
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../types';

export interface ListCustomersParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listCustomers(
  params: ListCustomersParams = {},
): Promise<CustomerListResponse> {
  const res = await api.get('/customers', { params });
  return { customers: res.data.data, meta: res.data.meta } as CustomerListResponse;
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  const res = await api.get(`/customers/${id}`);
  return res.data.data as CustomerDetail;
}

export async function createCustomer(data: CreateCustomerInput): Promise<Customer> {
  const res = await api.post('/customers', data);
  return res.data.data as Customer;
}

export async function updateCustomer(id: string, data: UpdateCustomerInput): Promise<Customer> {
  const res = await api.patch(`/customers/${id}`, data);
  return res.data.data as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`/customers/${id}`);
}
