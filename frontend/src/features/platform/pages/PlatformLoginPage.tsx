import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { usePlatformAuth } from '../context/PlatformAuthProvider';
import { platformLogin } from '../api/platform.api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password required'),
});

type FormValues = z.infer<typeof schema>;

export function PlatformLoginPage() {
  const { isAuthenticated, login } = usePlatformAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/admin/tenants" replace />;

  const onSubmit = async (values: FormValues): Promise<void> => {
    setServerError(null);
    setPending(true);
    try {
      const { accessToken, admin } = await platformLogin(values.email, values.password);
      login(accessToken, { ...admin, lastLoginAt: null });
      navigate('/admin/tenants', { replace: true });
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data?.error?.message as string | undefined)
        : undefined;
      setServerError(msg ?? 'Unable to sign in. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-foreground px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(1 0 0 / 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="inline-block h-[2px] w-9 bg-primary" />
          <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.22em] text-primary">
            TyreStock · Platform
          </span>
        </div>

        <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-white">Master console</h1>
        <p className="mb-7 text-sm text-white/45">
          Provision and manage the shops on your platform.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/70">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@tyrestock.app"
              aria-invalid={!!errors.email}
              className="border-white/15 bg-white/5 text-white placeholder:text-white/30"
              {...register('email')}
            />
            {errors.email && (
              <p role="alert" className="text-sm text-[oklch(0.78_0.16_27)]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/70">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className="border-white/15 bg-white/5 pr-10 text-white placeholder:text-white/30"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-white/40 hover:text-white/80"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p role="alert" className="text-sm text-[oklch(0.78_0.16_27)]">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-sm border border-[oklch(0.5_0.2_27)]/40 bg-[oklch(0.5_0.2_27)]/15 px-3.5 py-3 text-sm text-[oklch(0.82_0.14_27)]"
            >
              <AlertTriangle aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
