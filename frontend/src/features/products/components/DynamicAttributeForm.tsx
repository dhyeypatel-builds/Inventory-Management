import { useFormContext, Controller } from 'react-hook-form';
import { Label } from '@/shared/ui/label';
import { Input } from '@/shared/ui/input';
import { DatePicker } from '@/shared/ui/date-picker';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import type { Attribute } from '../types';

interface DynamicAttributeFormProps {
  attributes: Attribute[];
  /** Prefix in the form values, e.g. "variant.attributes" */
  fieldPrefix?: string;
}

export function DynamicAttributeForm({
  attributes,
  fieldPrefix = 'variant.attributes',
}: DynamicAttributeFormProps) {
  const { register, control, formState: { errors } } = useFormContext();

  if (attributes.length === 0) {
    return <p className="text-sm text-muted-foreground">No attributes defined for this product type.</p>;
  }

  // Helper to get nested error message
  function getError(code: string): string | undefined {
    const parts = `${fieldPrefix}.${code}`.split('.');
    let cur: Record<string, unknown> = errors as Record<string, unknown>;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object') return undefined;
      cur = cur[p] as Record<string, unknown>;
    }
    return (cur as { message?: string })?.message;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {attributes.map((attr) => {
        const fieldName = `${fieldPrefix}.${attr.code}`;
        const error = getError(attr.code);

        return (
          <div key={attr.id} className="space-y-1.5">
            <Label htmlFor={fieldName}>
              {attr.label}
              {attr.isRequired && <span className="ml-1 text-destructive">*</span>}
            </Label>

            {attr.datatype === 'ENUM' && (
              <Controller
                name={fieldName}
                control={control}
                rules={attr.isRequired ? { required: `${attr.label} is required` } : {}}
                render={({ field }) => (
                  <Select
                    value={field.value as string ?? ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id={fieldName} aria-label={attr.label}>
                      <SelectValue placeholder={`Select ${attr.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {attr.options.map((opt) => (
                        <SelectItem key={opt.id} value={opt.value}>
                          {opt.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}

            {attr.datatype === 'NUMBER' && (
              <Input
                id={fieldName}
                type="number"
                step="any"
                {...register(fieldName, {
                  valueAsNumber: true,
                  required: attr.isRequired ? `${attr.label} is required` : false,
                })}
              />
            )}

            {attr.datatype === 'TEXT' && (
              <Input
                id={fieldName}
                type="text"
                {...register(fieldName, {
                  required: attr.isRequired ? `${attr.label} is required` : false,
                })}
              />
            )}

            {attr.datatype === 'DATE' && (
              <Controller
                control={control}
                name={fieldName}
                rules={{ required: attr.isRequired ? `${attr.label} is required` : false }}
                render={({ field }) => (
                  <DatePicker
                    id={fieldName}
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            )}

            {attr.datatype === 'BOOLEAN' && (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id={fieldName} {...register(fieldName)} />
                <span className="text-sm text-muted-foreground">{attr.label}</span>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
