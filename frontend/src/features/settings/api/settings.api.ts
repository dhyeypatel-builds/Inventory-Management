import { api } from '@/shared/api/client';
import type {
  Settings,
  UpdateSettingsInput,
  Brand,
  Category,
} from '../types';

export async function getSettings(): Promise<Settings> {
  const res = await api.get('/settings');
  return res.data.data as Settings;
}

export async function updateSettings(patch: UpdateSettingsInput): Promise<Settings> {
  const res = await api.patch('/settings', patch);
  return res.data.data as Settings;
}

// ─── Brands ───────────────────────────────────────────────────────────────────

export async function listBrands(): Promise<Brand[]> {
  // 100 is the backend's max page size; the array lives directly in `data`.
  const res = await api.get('/brands', { params: { pageSize: 100, includeInactive: true } });
  return res.data.data as Brand[];
}

export async function createBrand(data: { name: string }): Promise<Brand> {
  const res = await api.post('/brands', data);
  return res.data.data as Brand;
}

export async function updateBrand(
  id: number,
  data: { name?: string; isActive?: boolean },
): Promise<Brand> {
  const res = await api.patch(`/brands/${id}`, data);
  return res.data.data as Brand;
}

export async function deleteBrand(id: number): Promise<void> {
  await api.delete(`/brands/${id}`);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  const res = await api.get('/categories', { params: { includeInactive: true } });
  return res.data.data as Category[];
}

export async function createCategory(data: { name: string; parentId?: number }): Promise<Category> {
  const res = await api.post('/categories', data);
  return res.data.data as Category;
}

export async function updateCategory(
  id: number,
  data: { name?: string; isActive?: boolean },
): Promise<Category> {
  const res = await api.patch(`/categories/${id}`, data);
  return res.data.data as Category;
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/categories/${id}`);
}
