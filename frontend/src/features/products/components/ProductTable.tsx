import { Link } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { formatDate } from '@/shared/lib/dates';
import type { ProductListItem } from '../types';

interface ProductTableProps {
  products?: ProductListItem[];
  loading?: boolean;
  onDelete?: (id: string) => void;
}

export function ProductTable({ products, loading, onDelete }: ProductTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No products found. Click &ldquo;Add Product&rdquo; to create one.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="whitespace-nowrap">Type</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead className="text-right">Variants</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {p.productType.name}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.brand?.name ?? <span>—</span>}
              </TableCell>
              <TableCell className="text-right font-mono tabular text-base font-semibold">
                {p._count.variants}
              </TableCell>
              <TableCell>
                <Badge variant={p.isActive ? 'success' : 'secondary'}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {formatDate(p.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/products/${p.id}/edit`} aria-label={`Edit ${p.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(p.id)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
