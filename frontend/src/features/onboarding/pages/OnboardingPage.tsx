import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AlertTriangle, Check, ImagePlus, Loader2, Plus, Sparkles, Store, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { AuthedImage } from '@/shared/ui/authed-image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { toast } from '@/shared/ui/use-toast';
import {
  completeOnboarding,
  demoSeed,
  getSettings,
  inviteStaff,
  updateSettings,
  uploadLogo,
} from '@/features/onboarding/api/onboarding.api';

const STEPS = ['Your shop', 'Defaults', 'Sample data', 'Your team'] as const;
const ROLES = ['SALES', 'INVENTORY', 'AUDITOR', 'ADMIN'] as const;

function errMsg(e: unknown): string {
  if (isAxiosError(e)) return (e.response?.data?.error?.message as string | undefined) ?? 'Something went wrong.';
  return 'Something went wrong.';
}

interface StaffRow {
  fullName: string;
  email: string;
  roleName: string;
}

export function OnboardingPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — shop details
  const [company, setCompany] = useState({ name: '', phone: '', address: '', vat_number: '', logo_url: '' });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2 — defaults
  const [taxPct, setTaxPct] = useState('20');
  const [reorder, setReorder] = useState('5');

  // Step 3 — sample data
  const [loadDemo, setLoadDemo] = useState(true);

  // Step 4 — team
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const { data: settings, isSuccess } = useQuery({ queryKey: ['onboarding', 'settings'], queryFn: getSettings });

  useEffect(() => {
    if (isSuccess && settings) {
      setCompany((c) => ({
        ...c,
        name: settings.company?.name ?? user?.tenantName ?? '',
        phone: settings.company?.phone ?? '',
        address: settings.company?.address ?? '',
        vat_number: settings.company?.vat_number ?? '',
        logo_url: settings.company?.logo_url ?? '',
      }));
      if (settings.tax?.default_pct != null) setTaxPct(String(settings.tax.default_pct));
      if (settings.inventory?.default_reorder_level != null) setReorder(String(settings.inventory.default_reorder_level));
    }
  }, [isSuccess, settings, user?.tenantName]);

  if (user && user.onboardingCompletedAt) return <Navigate to="/dashboard" replace />;

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadLogo(file);
      setCompany((c) => ({ ...c, logo_url: url }));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploading(false);
    }
  };

  const finish = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      for (const s of staff) {
        if (s.email && s.fullName) {
          await inviteStaff(s).catch(() => toast({ title: `Couldn't invite ${s.email}`, variant: 'destructive' }));
        }
      }
      const { onboardingCompletedAt } = await completeOnboarding();
      if (user) setUser({ ...user, onboardingCompletedAt });
      toast({ title: 'Your shop is ready', variant: 'success' });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const next = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (step === 0) {
        if (!company.name.trim()) throw new Error('Shop name is required');
        await updateSettings({ company });
      } else if (step === 1) {
        await updateSettings({
          tax: { default_pct: Number(taxPct) || 0 },
          inventory: { default_reorder_level: Number(reorder) || 0 },
        });
      } else if (step === 2) {
        if (loadDemo) {
          const r = await demoSeed();
          if (r.seeded) toast({ title: `Added ${r.products} sample tyres`, variant: 'success' });
        }
      }
      if (step === STEPS.length - 1) {
        await finish();
        return;
      }
      setStep((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error && !isAxiosError(err) ? err.message : errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="h-[3px] w-full bg-primary" aria-hidden />
      <div className="mx-auto flex min-h-[calc(100vh-3px)] max-w-2xl flex-col px-5 py-8 sm:py-12">
        {/* Brand + stepper */}
        <div className="mb-8">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="inline-block h-px w-7 bg-primary" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              TyreStock · Setup
            </span>
          </div>
          <ol className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={
                    'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ' +
                    (i < step ? 'bg-foreground text-background' : i === step ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground')
                  }
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={'hidden text-xs font-medium sm:block ' + (i === step ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
              </li>
            ))}
          </ol>
        </div>

        {/* Step body */}
        <div className="flex-1 rounded-lg border border-border bg-card p-6 sm:p-8">
          {step === 0 && (
            <Step title="Tell us about your shop" subtitle="This appears on invoices and the app header.">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface-2">
                  {company.logo_url ? (
                    <AuthedImage src={company.logo_url} alt="Shop logo" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickLogo} />
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {company.logo_url ? 'Replace logo' : 'Upload logo'}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPEG or WebP, up to 2 MB.</p>
                </div>
              </div>

              <Field label="Shop name" required>
                <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Acme Tyres" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone">
                  <Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} placeholder="020 7946 0000" />
                </Field>
                <Field label="VAT number">
                  <Input value={company.vat_number} onChange={(e) => setCompany({ ...company, vat_number: e.target.value })} placeholder="GB123456789" />
                </Field>
              </div>
              <Field label="Address">
                <Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} placeholder="12 Garage Lane, London" />
              </Field>
            </Step>
          )}

          {step === 1 && (
            <Step title="Set your defaults" subtitle="Used when you add products and stock. You can change these anytime in Settings.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default VAT rate (%)">
                  <Input type="number" inputMode="decimal" min={0} max={100} value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
                </Field>
                <Field label="Low-stock alert level">
                  <Input type="number" inputMode="numeric" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} />
                </Field>
              </div>
              <p className="text-sm text-muted-foreground">
                We'll warn you when a tyre's on-hand quantity drops to the alert level.
              </p>
            </Step>
          )}

          {step === 2 && (
            <Step title="Want a head start?" subtitle="Load a handful of sample tyres and customers to explore the app. You can clear them later from Settings.">
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard active={loadDemo} onClick={() => setLoadDemo(true)} icon={<Sparkles className="h-5 w-5" />} title="Load sample data" desc="5 tyres with stock + 2 customers" />
                <ChoiceCard active={!loadDemo} onClick={() => setLoadDemo(false)} icon={<Store className="h-5 w-5" />} title="Start empty" desc="Add your own catalogue from scratch" />
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="Invite your team" subtitle="Optional — add colleagues now or later from Settings. They'll get an email to set up sign-in.">
              <div className="space-y-3">
                {staff.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
                    <Input placeholder="Name" value={row.fullName} onChange={(e) => setStaff(staff.map((r, j) => (j === i ? { ...r, fullName: e.target.value } : r)))} />
                    <Input placeholder="Email" type="email" value={row.email} onChange={(e) => setStaff(staff.map((r, j) => (j === i ? { ...r, email: e.target.value } : r)))} />
                    <Select value={row.roleName} onValueChange={(v) => setStaff(staff.map((r, j) => (j === i ? { ...r, roleName: v } : r)))}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r[0] + r.slice(1).toLowerCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setStaff(staff.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setStaff([...staff, { fullName: '', email: '', roleName: 'SALES' }])}>
                  <Plus className="h-4 w-4" /> Add a team member
                </Button>
              </div>
            </Step>
          )}

          {error && (
            <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]">
              <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="mt-5 flex items-center justify-between">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => { setError(null); setStep((s) => s - 1); }} disabled={busy}>
              Back
            </Button>
          ) : <span />}
          <Button type="button" onClick={next} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === STEPS.length - 1 ? 'Finish setup' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ChoiceCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'relative rounded-md border p-4 text-left transition-colors ' +
        (active ? 'border-primary bg-primary/[0.06]' : 'border-border bg-card hover:border-foreground/20')
      }
    >
      {active && (
        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      <span className="mb-2.5 inline-grid h-9 w-9 place-items-center rounded-sm bg-foreground text-background">{icon}</span>
      <p className="text-sm font-semibold tracking-tight">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}
