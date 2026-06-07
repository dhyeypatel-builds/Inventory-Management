import { useState } from 'react';
import { Link } from 'react-router';
import { Package, Plus, Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { ProductTable } from '../components/ProductTable';
import { useProducts, useProductTypes, useBrands, useDeleteProduct } from '../hooks/useProducts';
import { toast } from '@/shared/ui/use-toast';

export function ProductListPage() {
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<number | undefined>();
  const [typeFilter, setTypeFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useProducts({
    q: search || undefined,
    brand: brandFilter,
    type: typeFilter,
    page,
    pageSize: 20,
  });

  const { data: productTypes } = useProductTypes();
  const { data: brands } = useBrands();
  const deleteProduct = useDeleteProduct();

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? This action cannot be undone.')) return;
    try {
      await deleteProduct.mutateAsync(id);
      toast({ title: 'Product deleted', variant: 'success' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  }

  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Product catalogue
          </p>
        </div>
        <Button asChild>
          <Link to="/products/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select
          value={typeFilter ? String(typeFilter) : 'all'}
          onValueChange={(v) => { setTypeFilter(v === 'all' ? undefined : Number(v)); setPage(1); }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {productTypes?.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={brandFilter ? String(brandFilter) : 'all'}
          onValueChange={(v) => { setBrandFilter(v === 'all' ? undefined : Number(v)); setPage(1); }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by brand">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands?.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (data?.products?.length ?? 0) === 0 && !search && !brandFilter && !typeFilter ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first tyre to start tracking stock and selling. Pick a product type, set the SKU and price, and you're ready."
          action={
            <Button asChild>
              <Link to="/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Add product
              </Link>
            </Button>
          }
        />
      ) : (
        <ProductTable
          products={data?.products}
          loading={isLoading}
          onDelete={handleDelete}
        />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} products
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
