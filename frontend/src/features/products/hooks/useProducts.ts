import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  listProductTypes,
  getProductTypeAttributes,
  listBrands,
  listCategories,
  type ListProductsParams,
} from '../api/products.api';
import type { ProductFormData } from '../types';

export const productKeys = {
  all: ['products'] as const,
  list: (params: ListProductsParams) => ['products', 'list', params] as const,
  detail: (id: string) => ['products', 'detail', id] as const,
  types: ['product-types'] as const,
  typeAttributes: (typeId: number) => ['product-types', typeId, 'attributes'] as const,
  brands: ['brands'] as const,
  categories: ['categories'] as const,
};

export function useProducts(params: ListProductsParams = {}) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => listProducts(params),
    staleTime: 30_000,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => getProduct(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useProductTypes() {
  return useQuery({
    queryKey: productKeys.types,
    queryFn: listProductTypes,
    staleTime: 5 * 60_000,
  });
}

export function useProductTypeAttributes(typeId: number | undefined) {
  return useQuery({
    queryKey: productKeys.typeAttributes(typeId ?? 0),
    queryFn: () => getProductTypeAttributes(typeId!),
    enabled: !!typeId,
    staleTime: 5 * 60_000,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: productKeys.brands,
    queryFn: listBrands,
    staleTime: 5 * 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories,
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductFormData) => createProduct(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProductFormData>) => updateProduct(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      qc.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
