import { useState } from 'react';
import { CheckCircle2, Mail, Send, UserPlus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { toast } from '@/shared/ui/use-toast';
import { InvoiceView } from './InvoiceView';
import { useEmailInvoice } from '../hooks/useSales';
import { createCustomer } from '../api/sales.api';
import type { SaleDetail, InvoiceCompany } from '../types';

interface SaleCompleteProps {
  sale: SaleDetail;
  company?: InvoiceCompany;
  onNewSale: () => void;
}

export function SaleComplete({ sale, company, onNewSale }: SaleCompleteProps) {
  // ─── Email the invoice ───────────────────────────────────────────────────────
  const emailInvoice = useEmailInvoice();
  const [email, setEmail] = useState(sale.customerEmail ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      await emailInvoice.mutateAsync({ id: sale.id, email: trimmed });
      setSentTo(trimmed);
      toast({ title: `Invoice sent to ${trimmed}`, variant: 'success' });
    } catch {
      toast({
        title: 'Could not send invoice',
        description: 'Check the email address and try again.',
        variant: 'destructive',
      });
    }
  }

  // ─── Offer to save a walk-in as a customer ──────────────────────────────────
  // Only when the sale isn't already linked to a saved customer.
  const isWalkIn = !sale.customerId;
  const [showSave, setShowSave] = useState(isWalkIn);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(sale.customerName ?? '');
  const [phone, setPhone] = useState('');
  const [custEmail, setCustEmail] = useState(sale.customerEmail ?? '');

  async function handleSaveCustomer() {
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;
    setSaving(true);
    try {
      await createCustomer({
        name: trimmedName,
        phone: phone.trim() || undefined,
        email: custEmail.trim() || undefined,
      });
      setSaved(true);
      setShowSave(false);
      toast({ title: `Customer "${trimmedName}" saved`, variant: 'success' });
    } catch {
      toast({ title: 'Could not save customer', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-success/12 text-[oklch(0.45_0.13_150)]">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sale Complete</h1>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Invoice generated
            </p>
          </div>
        </div>
        <Button onClick={onNewSale}>New Sale</Button>
      </div>

      {/* Email the invoice — available for every sale, customer or walk-in. */}
      <div className="space-y-2.5 rounded-sm border border-border bg-card p-4 shadow-panel print:hidden">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Email invoice
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invoice-email">Send to</Label>
            <Input
              id="invoice-email"
              type="email"
              inputMode="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!email.trim() || emailInvoice.isPending}
            className="sm:w-auto"
          >
            <Send className="mr-1.5 h-4 w-4" />
            {emailInvoice.isPending ? 'Sending…' : sentTo ? 'Resend' : 'Send invoice'}
          </Button>
        </div>
        {sentTo && (
          <p className="text-xs text-muted-foreground">
            Sent to <span className="font-medium text-foreground">{sentTo}</span>.
          </p>
        )}
      </div>

      {/* Walk-in: offer to save them as a customer for next time. */}
      {showSave && !saved && (
        <div className="space-y-3 rounded-sm border border-dashed border-primary/40 bg-primary/[0.05] p-4 print:hidden">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <span className="font-semibold">Do you want to add this customer?</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Save this walk-in so you can find them on the next sale. Optional.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Name</Label>
              <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">Phone</Label>
              <Input
                id="cust-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">Email</Label>
              <Input
                id="cust-email"
                type="email"
                value={custEmail}
                onChange={(e) => setCustEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSave(false)}>
              Not now
            </Button>
            <Button size="sm" onClick={handleSaveCustomer} disabled={!name.trim() || saving}>
              {saving ? 'Saving…' : 'Save customer'}
            </Button>
          </div>
        </div>
      )}

      <InvoiceView sale={sale} company={company} />
    </div>
  );
}
