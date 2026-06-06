import { formatCurrency } from '@/shared/lib/currency';
import { formatDate } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import type { CustomerSaleSummary } from '../types';

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary'> = {
  CONFIRMED: 'default',
  RETURNED: 'secondary',
  CANCELLED: 'outline',
};

interface PurchaseHistoryProps {
  sales: CustomerSaleSummary[];
}

export function PurchaseHistory({ sales }: PurchaseHistoryProps) {
  if (sales.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No purchase history yet.</p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-sm">{s.invoiceNo}</TableCell>
              <TableCell>{formatDate(s.soldAt)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[s.status] ?? 'default'}>
                  {s.status}
                </Badge>
              </TableCell>
              <TableCell>{s.paymentMode ?? '—'}</TableCell>
              <TableCell className="text-right">{formatCurrency(s.grandTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
