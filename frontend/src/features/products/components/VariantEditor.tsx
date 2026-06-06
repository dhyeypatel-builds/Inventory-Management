import { useFormContext } from 'react-hook-form';
import { Label } from '@/shared/ui/label';
import { Input } from '@/shared/ui/input';
import { Separator } from '@/shared/ui/separator';
import { DynamicAttributeForm } from './DynamicAttributeForm';
import type { Attribute } from '../types';

interface VariantEditorProps {
  attributes: Attribute[];
  suggestedSku?: string;
}

export function VariantEditor({ attributes, suggestedSku }: VariantEditorProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  type NestedErrors = Record<string, { message?: string } | undefined>;
  const variantErrors = (errors.variant as NestedErrors | undefined) ?? {};

  return (
    <div className="space-y-4">
      <Separator />
      <h3 className="text-sm font-semibold">Variant Details</h3>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="variant.sku">
            SKU <span className="text-destructive">*</span>
          </Label>
          <Input
            id="variant.sku"
            placeholder={suggestedSku ?? 'e.g. TYR-MRF-001'}
            {...register('variant.sku', {
              required: 'SKU is required',
              pattern: {
                value: /^[A-Z0-9-]{3,60}$/,
                message: 'SKU must be 3-60 uppercase letters, digits, or hyphens',
              },
            })}
          />
          {variantErrors.sku && (
            <p className="text-xs text-destructive">{variantErrors.sku.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant.purchasePrice">
            Purchase Price (£) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="variant.purchasePrice"
            type="number"
            min="0"
            step="0.01"
            {...register('variant.purchasePrice', {
              valueAsNumber: true,
              required: 'Purchase price is required',
              min: { value: 0, message: 'Must be ≥ 0' },
            })}
          />
          {variantErrors.purchasePrice && (
            <p className="text-xs text-destructive">{variantErrors.purchasePrice.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant.sellingPrice">
            Selling Price (£) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="variant.sellingPrice"
            type="number"
            min="0"
            step="0.01"
            {...register('variant.sellingPrice', {
              valueAsNumber: true,
              required: 'Selling price is required',
              min: { value: 0, message: 'Must be ≥ 0' },
            })}
          />
          {variantErrors.sellingPrice && (
            <p className="text-xs text-destructive">{variantErrors.sellingPrice.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant.taxRatePct">Tax Rate (%)</Label>
          <Input
            id="variant.taxRatePct"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={0}
            {...register('variant.taxRatePct', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be ≥ 0' },
              max: { value: 100, message: 'Must be ≤ 100' },
            })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant.openingStock">Opening Stock</Label>
          <Input
            id="variant.openingStock"
            type="number"
            min="0"
            defaultValue={0}
            {...register('variant.openingStock', { valueAsNumber: true, min: 0 })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant.reorderLevel">Reorder Level</Label>
          <Input
            id="variant.reorderLevel"
            type="number"
            min="0"
            defaultValue={5}
            {...register('variant.reorderLevel', { valueAsNumber: true, min: 0 })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant.barcode">Barcode</Label>
          <Input id="variant.barcode" {...register('variant.barcode')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant.rackLocation">Rack Location</Label>
          <Input id="variant.rackLocation" placeholder="e.g. A-01" {...register('variant.rackLocation')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant.manufacturingDate">Manufacturing Date</Label>
          <Input id="variant.manufacturingDate" type="date" {...register('variant.manufacturingDate')} />
        </div>
      </div>

      {attributes.length > 0 && (
        <>
          <Separator />
          <h3 className="text-sm font-semibold">Attributes</h3>
          <DynamicAttributeForm attributes={attributes} fieldPrefix="variant.attributes" />
        </>
      )}
    </div>
  );
}
