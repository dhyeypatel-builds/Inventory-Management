import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { KeyRound } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Toaster } from '@/shared/ui/toaster';
import { toast } from '@/shared/ui/use-toast';
import { useAuth } from '@/app/providers';
import { changePassword } from '../api/auth.api';

const schema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

/**
 * Account security page — reachable by every signed-in user regardless of role
 * (unlike Settings, which needs settings:read). Passwordless invited users use
 * it to SET their first password; everyone else to change theirs.
 */
export function AccountPage() {
  const { user, setUser } = useAuth();
  // Sessions stored before hasPassword existed: assume a password is set.
  const hasPassword = user?.hasPassword !== false;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(values: FormValues) {
    if (hasPassword && (values.currentPassword?.length ?? 0) < 8) {
      setError('currentPassword', { message: 'Enter your current password' });
      return;
    }
    try {
      await changePassword({
        currentPassword: hasPassword ? values.currentPassword : undefined,
        newPassword: values.newPassword,
      });
      if (user) setUser({ ...user, hasPassword: true });
      reset();
      toast({
        title: hasPassword ? 'Password changed' : 'Password set',
        description: 'Other devices will be signed out shortly.',
        variant: 'success',
      });
    } catch (err) {
      const message = isAxiosError(err)
        ? ((err.response?.data as { error?: { message?: string } })?.error?.message ??
          'Something went wrong')
        : 'Something went wrong';
      toast({ title: 'Could not update password', description: message, variant: 'destructive' });
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Your sign-in and security
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-semibold">{user?.fullName}</p>
          <p className="text-muted-foreground">{user?.email}</p>
          <div className="pt-1">
            <Badge variant="outline">{user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {hasPassword ? 'Change password' : 'Set a password'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasPassword && (
            <p className="mb-4 text-sm text-muted-foreground">
              You currently sign in with an emailed code. Setting a password adds a
              second way in — email codes keep working.
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {hasPassword && (
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <Input id="current-password" type="password" autoComplete="current-password" {...register('currentPassword')} />
                {errors.currentPassword && (
                  <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" {...register('newPassword')} />
              {errors.newPassword && (
                <p className="text-xs text-destructive">{errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Toaster />
    </div>
  );
}
