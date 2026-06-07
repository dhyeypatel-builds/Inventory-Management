import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, MailCheck } from 'lucide-react';
import { isAxiosError } from 'axios';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useLogin, useVerifyOtp } from '@/features/auth/hooks/useLogin';
import { requestOtp } from '@/features/auth/api/auth.api';

type Mode = 'password' | 'otp';

function serverError(error: unknown): string {
  if (isAxiosError(error)) {
    return (error.response?.data?.error?.message as string | undefined) ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

// ─── Password sign-in ───────────────────────────────────────────────────────────

const passwordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password required'),
});
type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordForm({ onUseCode }: { onUseCode: (email: string) => void }) {
  const { mutate, isPending, error } = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  return (
    <form onSubmit={handleSubmit((v) => mutate(v))} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="you@shop.co.uk" aria-invalid={!!errors.email} {...register('email')} />
        {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" aria-invalid={!!errors.password} className="pr-10" {...register('password')} />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p role="alert" className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]">
          <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
          <span>{serverError(error)}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>

      <button type="button" onClick={() => onUseCode(getValues('email'))} className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Email me a sign-in code instead
      </button>
    </form>
  );
}

// ─── OTP sign-in ────────────────────────────────────────────────────────────────

const emailSchema = z.object({ email: z.string().email('Enter a valid email address') });
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });

function OtpForm({ initialEmail, onUsePassword }: { initialEmail: string; onUsePassword: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const verify = useVerifyOtp();

  const emailForm = useForm<{ email: string }>({ resolver: zodResolver(emailSchema), defaultValues: { email: initialEmail } });
  const codeForm = useForm<{ code: string }>({ resolver: zodResolver(codeSchema) });

  const send = async (value: string): Promise<void> => {
    setRequestError(null);
    setSending(true);
    try {
      await requestOtp(value);
      setEmail(value);
      setSent(true);
    } catch (err) {
      setRequestError(serverError(err));
    } finally {
      setSending(false);
    }
  };

  if (!sent) {
    return (
      <form onSubmit={emailForm.handleSubmit((v) => send(v.email))} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp-email">Email</Label>
          <Input id="otp-email" type="email" autoComplete="email" placeholder="you@shop.co.uk" aria-invalid={!!emailForm.formState.errors.email} {...emailForm.register('email')} />
          {emailForm.formState.errors.email && <p role="alert" className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>}
        </div>

        {requestError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]">
            <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
            <span>{requestError}</span>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? 'Sending…' : 'Email me a code'}
        </Button>
        <button type="button" onClick={onUsePassword} className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Sign in with a password instead
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={codeForm.handleSubmit((v) => verify.mutate({ email, code: v.code }))} noValidate className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-sm border border-success/25 bg-success/10 px-3.5 py-3 text-sm text-[oklch(0.45_0.13_150)]">
        <MailCheck aria-hidden className="mt-px h-4 w-4 shrink-0" />
        <span>We sent a 6-digit code to <strong className="font-semibold">{email}</strong>. It expires in 10 minutes.</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="otp-code">Sign-in code</Label>
        <Input
          id="otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="text-center font-mono text-lg tracking-[0.4em]"
          aria-invalid={!!codeForm.formState.errors.code}
          {...codeForm.register('code')}
        />
        {codeForm.formState.errors.code && <p role="alert" className="text-sm text-destructive">{codeForm.formState.errors.code.message}</p>}
      </div>

      {verify.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]">
          <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
          <span>{serverError(verify.error)}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={verify.isPending}>
        {verify.isPending ? 'Verifying…' : 'Verify and sign in'}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => setSent(false)} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Change email
        </button>
        <button type="button" onClick={() => send(email)} disabled={sending} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50">
          {sending ? 'Resending…' : 'Resend code'}
        </button>
      </div>
    </form>
  );
}

// ─── Switcher ─────────────────────────────────────────────────────────────────

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('password');
  const [seedEmail, setSeedEmail] = useState('');

  return mode === 'password' ? (
    <PasswordForm onUseCode={(email) => { setSeedEmail(email); setMode('otp'); }} />
  ) : (
    <OtpForm initialEmail={seedEmail} onUsePassword={() => setMode('password')} />
  );
}
