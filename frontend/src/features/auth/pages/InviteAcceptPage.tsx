import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, MailCheck, Store } from 'lucide-react';
import { isAxiosError } from 'axios';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { getInvite, requestOtp } from '@/features/auth/api/auth.api';
import { useVerifyOtp } from '@/features/auth/hooks/useLogin';
import { AuthShell } from '@/features/auth/components/AuthShell';

function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    return (error.response?.data?.error?.message as string | undefined) ?? 'This invite link is not valid.';
  }
  return 'This invite link is not valid.';
}

export function InviteAcceptPage() {
  const { token = '' } = useParams();
  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => getInvite(token),
    retry: false,
  });

  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const verify = useVerifyOtp();

  const send = async (): Promise<void> => {
    if (!invite) return;
    setSendError(null);
    setSending(true);
    try {
      await requestOtp(invite.email);
      setSent(true);
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <AuthShell title="Loading your invite…">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthShell>
    );
  }

  if (error || !invite) {
    return (
      <AuthShell title="Invite not available">
        <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]">
          <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
          <span>{errorMessage(error)} It may have expired or already been used. Ask your shop admin for a fresh one.</span>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Accept your invite">
      <div className="mb-5 flex items-center gap-3 rounded-sm border border-border bg-card p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-foreground text-background">
          <Store className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{invite.tenantName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {invite.email} · {invite.roleName.toLowerCase()}
          </p>
        </div>
      </div>

      {!sent ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We'll email a 6-digit code to <strong className="text-foreground">{invite.email}</strong> to
            confirm it's you and finish setting up your sign-in.
          </p>
          {sendError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]">
              <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}
          <Button className="w-full" onClick={send} disabled={sending}>
            {sending ? 'Sending…' : 'Email me a code'}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); verify.mutate({ email: invite.email, code }); }}
          noValidate
          className="space-y-4"
        >
          <div className="flex items-start gap-2.5 rounded-sm border border-success/25 bg-success/10 px-3.5 py-3 text-sm text-[oklch(0.45_0.13_150)]">
            <MailCheck aria-hidden className="mt-px h-4 w-4 shrink-0" />
            <span>Code sent to <strong className="font-semibold">{invite.email}</strong>. It expires in 10 minutes.</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-code">Sign-in code</Label>
            <Input
              id="invite-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center font-mono text-lg tracking-[0.4em]"
            />
          </div>
          {verify.error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]">
              <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
              <span>{errorMessage(verify.error)}</span>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={verify.isPending || code.length !== 6}>
            {verify.isPending ? 'Verifying…' : 'Accept and continue'}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => setSent(false)} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button type="button" onClick={send} disabled={sending} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50">
              {sending ? 'Resending…' : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
