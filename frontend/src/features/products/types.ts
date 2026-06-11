export type AttributeDatatype = 'TEXT' | 'NUMBER' | 'ENUM' | 'DATE' | 'BOOLEAN';

export interface AttributeOption {
  id: number;
  value: string;
  displayOrder: number;
}

export interface Attribute {
  id: number;
  productTypeId: number;
  code: string;
  label: string;
  datatype: AttributeDatatype;
  isRequired: boolean;
  isVariantDefining: boolean;
  displayOrder: number;
  options: AttributeOption[];
}

export interface ProductType {
  id: number;
  name: string;
  isStockable: boolean;
  isActive: boolean;
}

export interface Brand {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  isActive: boolean;
}

export interface VariantAttributeValue {
  attributeId: number;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBool?: boolean | null;
  optionId?: number | null;
  attribute: { code: string; label: string; datatype: AttributeDatatype };
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRatePct: number;
  barcode: string | null;
  manufacturingDate: string | null;
  isActive: boolean;
  attributeValues: VariantAttributeValue[];
  inventory: {
    quantity: number;
    reorderLevel: number;
    rackLocation: string | null;
  } | null;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  warrantyMonths: number | null;
  isActive: boolean;
  productType: { id: number; name: string };
  brand: { id: number; name: string } | null;
  category: { id: number; name: string; slug: string } | null;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  isActive: boolean;
  productType: { id: number; name: string };
  brand: { id: number; name: string } | null;
  category: { id: number; name: string } | null;
  variants: { sku: string }[];
  _count: { variants: number };
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductListResponse {
  products: ProductListItem[];
  meta: PaginationMeta;
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface VariantFormData {
  sku: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRatePct: number;
  manufacturingDate?: string;
  barcode?: string;
  openingStock: number;
  rackLocation?: string;
  reorderLevel: number;
  attributes: Record<string, string | number | boolean>;
}

export interface ProductFormData {
  productTypeId: number;
  brandId?: number;
  categoryId?: number;
  name: string;
  description?: string;
  warrantyMonths?: number;
  variant?: VariantFormData;
}
