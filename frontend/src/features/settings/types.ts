export interface CompanySettings {
  name?: string;
  phone?: string;
  address?: string;
  vat_number?: string;
  logo_url?: string;
}

export interface Settings {
  company?: CompanySettings;
  tax?: { default_pct?: number };
  inventory?: { default_reorder_level?: number };
}

export interface UpdateSettingsInput {
  company?: Partial<CompanySettings>;
  tax?: { default_pct?: number };
  inventory?: { default_reorder_level?: number };
}

export interface Brand {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface BrandListResponse {
  brands: Brand[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  isActive: boolean;
  parent?: { id: number; name: string; slug: string } | null;
  children?: { id: number; name: string; slug: string; isActive: boolean }[];
}
