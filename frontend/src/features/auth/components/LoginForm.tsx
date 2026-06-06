import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { isAxiosError } from 'axios';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password required'),
});

type FormValues = z.infer<typeof schema>;

function getServerError(error: unknown): string {
  if (isAxiosError(error)) {
    const msg = error.response?.data?.error?.message as string | undefined;
    return msg ?? 'An unexpected error occurred. Please try again.';
  }
  return 'An unexpected error occurred. Please try again.';
}

export function LoginForm() {
  const { mutate, isPending, error } = useLogin();
  const [showResetHint, setShowResetHint] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (values: FormValues): void => {
    mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="admin@tyrestock.app"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            aria-expanded={showResetHint}
            aria-controls="reset-hint"
            onClick={() => setShowResetHint((v) => !v)}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {showResetHint && (
          <p id="reset-hint" className="text-xs text-muted-foreground">
            Ask your shop admin to reset it from Settings.
          </p>
        )}
        {errors.password && (
          <p role="alert" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]"
        >
          <AlertTriangle aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
          <span>{getServerError(error)}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
