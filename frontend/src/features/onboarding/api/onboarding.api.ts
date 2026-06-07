import { api } from '@/shared/api/client';

export interface NestedSettings {
  company?: { name?: string; phone?: string; address?: string; vat_number?: string; logo_url?: string };
  tax?: { default_pct?: number };
  inventory?: { default_reorder_level?: number };
}

export async function getSettings(): Promise<NestedSettings> {
  const res = await api.get<{ data: NestedSettings }>('/settings');
  return res.data.data;
}

export async function updateSettings(patch: NestedSettings): Promise<void> {
  await api.patch('/settings', patch);
}

export async function uploadLogo(file: File): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ data: { url: string; key: string } }>('/uploads/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function demoSeed(): Promise<{ seeded: boolean; products: number; customers: number }> {
  const res = await api.post<{ data: { seeded: boolean; products: number; customers: number } }>(
    '/onboarding/demo-seed',
    {},
  );
  return res.data.data;
}

export async function inviteStaff(input: { fullName: string; email: string; roleName: string }): Promise<void> {
  await api.post('/team/invites', input);
}

export async function completeOnboarding(): Promise<{ onboardingCompletedAt: string }> {
  const res = await api.post<{ data: { onboardingCompletedAt: string } }>('/onboarding/complete', {});
  return res.data.data;
}
