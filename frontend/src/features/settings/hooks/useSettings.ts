import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSettings,
  updateSettings,
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../api/settings.api';
import type { UpdateSettingsInput } from '../types';

export const settingsKeys = {
  settings: ['settings'] as const,
  brands: ['settings', 'brands'] as const,
  categories: ['settings', 'categories'] as const,
};

export function useSettings() {
  return useQuery({ queryKey: settingsKeys.settings, queryFn: getSettings });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateSettingsInput) => updateSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.settings }),
  });
}

export function useSettingsBrands() {
  return useQuery({ queryKey: settingsKeys.brands, queryFn: listBrands });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => createBrand(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.brands }),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; isActive?: boolean };
    }) => updateBrand(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.brands }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBrand(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.brands }),
  });
}

export function useSettingsCategories() {
  return useQuery({ queryKey: settingsKeys.categories, queryFn: listCategories });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parentId?: number }) => createCategory(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.categories }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; isActive?: boolean };
    }) => updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.categories }),
  });
}
