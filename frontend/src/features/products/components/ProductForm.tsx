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
import { useProductTypes, useProductTypeAttributes, useBrands, useCategories, useCreateProduct } from '../hooks/useProducts';
import type { ProductFormData } from '../types';

interface ProductFormProps {
  defaultValues?: Partial<ProductFormData>;
  productId?: string;
}

export function ProductForm({ defaultValues }: ProductFormProps) {
  const navigate = useNavigate();
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>(
    defaultValues?.productTypeId,
  );

  const { data: productTypes, isLoading: typesLoading } = useProductTypes();
  const { data: attributes = [] } = useProductTypeAttributes(selectedTypeId);
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const createProduct = useCreateProduct();

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
    formState: { errors, isSubmitting },
  } = methods;

  const watchedTypeId = watch('productTypeId');

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
      await createProduct.mutateAsync(data);
      toast({ title: 'Product created', variant: 'success' });
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
            disabled={typesLoading}
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
            <Select
              value={watch('brandId') ? String(watch('brandId')) : ''}
              onValueChange={(v) => setValue('brandId', Number(v))}
            >
              <SelectTrigger id="brandId" aria-label="Brand">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <Select
              value={watch('categoryId') ? String(watch('categoryId')) : ''}
              onValueChange={(v) => setValue('categoryId', Number(v))}
            >
              <SelectTrigger id="categoryId" aria-label="Category">
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

        {/* Variant editor (only shown when a type is selected) */}
        {selectedTypeId && (
          <VariantEditor attributes={attributes} />
        )}

        {!selectedTypeId && (
          <p className="text-sm text-muted-foreground">
            Select a product type above to add variant details and attributes.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting || !selectedTypeId}>
            {isSubmitting ? 'Saving…' : 'Save Product'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>
            Cancel
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
