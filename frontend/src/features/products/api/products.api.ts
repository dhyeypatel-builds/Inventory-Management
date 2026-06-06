import { api } from '@/shared/api/client';
import type {
  Product,
  ProductListResponse,
  ProductFormData,
  Attribute,
  ProductType,
  Brand,
  Category,
} from '../types';

// ─── Products ─────────────────────────────────────────────────────────────────

export interface ListProductsParams {
  q?: string;
  brand?: number;
  type?: number;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export async function listProducts(params: ListProductsParams = {}): Promise<ProductListResponse> {
  const res = await api.get('/products', { params });
  return { products: res.data.data, meta: res.data.meta } as ProductListResponse;
}

export async function getProduct(id: string): Promise<Product> {
  const res = await api.get(`/products/${id}`);
  return res.data.data as Product;
}

export async function createProduct(data: ProductFormData): Promise<Product> {
  const res = await api.post('/products', data);
  return res.data.data as Product;
}

export async function updateProduct(id: string, data: Partial<ProductFormData>): Promise<Product> {
  const res = await api.patch(`/products/${id}`, data);
  return res.data.data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`);
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function listProductTypes(): Promise<ProductType[]> {
  const res = await api.get('/product-types');
  return res.data.data as ProductType[];
}

export async function getProductTypeAttributes(typeId: number): Promise<Attribute[]> {
  const res = await api.get(`/product-types/${typeId}/attributes`);
  return res.data.data as Attribute[];
}

export async function listBrands(): Promise<Brand[]> {
  const res = await api.get('/brands', { params: { pageSize: 200 } });
  return res.data.data as Brand[];
}

export async function listCategories(): Promise<Category[]> {
  const res = await api.get('/categories');
  return res.data.data as Category[];
}
