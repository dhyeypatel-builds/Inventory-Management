import { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Label } from '@/shared/ui/label';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { toast } from '@/shared/ui/use-toast';
import { VariantEditor } from './VariantEditor';
import { QuickAddDialog } from './QuickAddDialog';
import { createBrand, createCategory } from '../api/products.api';
import { useQueryClient } from '@tanstack/react-query';
import { productKeys } from '../hooks/useProducts';
import {
  useProductTypes,
  useProductTypeAttributes,
  useBrands,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  useProduct,
} from '../hooks/useProducts';
import type { ProductFormData } from '../types';

interface ProductFormProps {
  defaultValues?: Partial<ProductFormData>;
  productId?: string;
}

export function ProductForm({ defaultValues, productId }: ProductFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!productId;
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>(
    defaultValues?.productTypeId,
  );

  const { data: productTypes, isLoading: typesLoading } = useProductTypes();
  const { data: attributes = [] } = useProductTypeAttributes(selectedTypeId);
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const { data: existing } = useProduct(productId ?? '');
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(productId ?? '');

  const methods = useForm<ProductFormData>({
    defaultValues: {
      productTypeId: defaultValues?.productTypeId,
      brandId: defaultValues?.brandId,
      categoryId: defaultValues?.categoryId,
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      warrantyMonths: defaultValues?.warrantyMonths,
      variant: {
        sku: '',
        purchasePrice: 0,
        sellingPrice: 0,
        taxRatePct: 0,
        openingStock: 0,
        reorderLevel: 5,
        attributes: {},
      },
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = methods;

  const watchedTypeId = watch('productTypeId');

  // Edit mode: prefill the form once the existing product loads
  useEffect(() => {
    if (!existing) return;
    setSelectedTypeId(existing.productType.id);
    reset({
      productTypeId: existing.productType.id,
      brandId: existing.brand?.id,
      categoryId: existing.category?.id,
      name: existing.name,
      description: existing.description ?? '',
      warrantyMonths: existing.warrantyMonths ?? undefined,
      variant: {
        sku: '',
        purchasePrice: 0,
        sellingPrice: 0,
        taxRatePct: 0,
        openingStock: 0,
        reorderLevel: 5,
        attributes: {},
      },
    });
  }, [existing, reset]);

  // Sync controlled Select → RHF field
  useEffect(() => {
    if (selectedTypeId !== undefined) {
      setValue('productTypeId', selectedTypeId);
    }
  }, [selectedTypeId, setValue]);

  // Clear attributes when type changes
  useEffect(() => {
    setValue('variant.attributes', {});
  }, [watchedTypeId, setValue]);

  async function onSubmit(data: ProductFormData) {
    try {
      if (isEdit) {
        await updateProduct.mutateAsync({
          name: data.name,
          brandId: data.brandId,
          categoryId: data.categoryId,
          description: data.description || undefined,
          warrantyMonths: Number.isFinite(data.warrantyMonths) ? data.warrantyMonths : undefined,
        });
        toast({ title: 'Product updated', variant: 'success' });
      } else {
        await createProduct.mutateAsync(data);
        toast({ title: 'Product created', variant: 'success' });
      }
      navigate('/products');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to save product';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Product type */}
        <div className="space-y-1.5">
          <Label htmlFor="productTypeId">
            Product Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={selectedTypeId ? String(selectedTypeId) : ''}
            onValueChange={(v) => setSelectedTypeId(Number(v))}
            disabled={typesLoading || isEdit}
          >
            <SelectTrigger id="productTypeId" aria-label="Product Type">
              <SelectValue placeholder="Select product type" />
            </SelectTrigger>
            <SelectContent>
              {productTypes?.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.productTypeId && (
            <p className="text-xs text-destructive">{String(errors.productTypeId.message)}</p>
          )}
        </div>

        <Separator />

        {/* Core product fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. MRF ZTX 195/65R15"
              {...register('name', { required: 'Product name is required', minLength: 1, maxLength: 160 })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brandId">Brand</Label>
            <div className="flex items-center gap-1.5">
              <Select
                value={watch('brandId') ? String(watch('brandId')) : ''}
                onValueChange={(v) => setValue('brandId', Number(v))}
              >
                <SelectTrigger id="brandId" aria-label="Brand" className="flex-1">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <QuickAddDialog
                entity="brand"
                onCreate={createBrand}
                onCreated={(id) => {
                  void queryClient.invalidateQueries({ queryKey: productKeys.brands });
                  setValue('brandId', id);
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <div className="flex items-center gap-1.5">
              <Select
                value={watch('categoryId') ? String(watch('categoryId')) : ''}
                onValueChange={(v) => setValue('categoryId', Number(v))}
              >
                <SelectTrigger id="categoryId" aria-label="Category" className="flex-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <QuickAddDialog
                entity="category"
                onCreate={createCategory}
                onCreated={(id) => {
                  void queryClient.invalidateQueries({ queryKey: productKeys.categories });
                  setValue('categoryId', id);
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="warrantyMonths">Warranty (months)</Label>
            <Input
              id="warrantyMonths"
              type="number"
              min="0"
              {...register('warrantyMonths', { valueAsNumber: true, min: 0 })}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register('description')} />
          </div>
        </div>

        {/* Variant editor (create mode only — variants are edited from Inventory) */}
        {!isEdit && selectedTypeId && (
          <VariantEditor attributes={attributes} />
        )}

        {!isEdit && !selectedTypeId && (
          <p className="text-sm text-muted-foreground">
            Select a product type above to add variant details and attributes.
          </p>
        )}

        {isEdit && existing && existing.variants.length > 0 && (
          <div className="space-y-2">
            <Label>Variants</Label>
            <ul className="space-y-1">
              {existing.variants.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-sm"
                >
                  <span className="font-mono">{v.sku}</span>
                  <span className="font-mono tabular text-muted-foreground">
                    Stock: {v.inventory?.quantity ?? 0}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Stock and prices are managed from the Inventory screen.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting || !selectedTypeId}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Product'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>
            Cancel
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
