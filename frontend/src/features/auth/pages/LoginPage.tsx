import { Navigate } from 'react-router';
import { useAuth } from '@/app/providers';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { AuthShell } from '@/features/auth/components/AuthShell';

export function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <AuthShell title="Sign in">
      <LoginForm />
    </AuthShell>
  );
}
