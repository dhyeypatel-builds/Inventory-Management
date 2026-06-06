import { Link } from 'react-router';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { SalesHistory } from '../components/SalesHistory';

export function SalesHistoryPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales History</h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Sales ledger
          </p>
        </div>
        <Button asChild>
          <Link to="/sales/pos">
            <ShoppingCart className="mr-1.5 h-4 w-4" />
            New Sale
          </Link>
        </Button>
      </div>
      <SalesHistory />
    </div>
  );
}
