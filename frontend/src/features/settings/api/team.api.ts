import { api } from '@/shared/api/client';

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  pending: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  roleName: string;
  expiresAt: string;
  createdAt: string;
}

export interface TeamData {
  members: TeamMember[];
  invites: PendingInvite[];
}

export const STAFF_ROLES = ['ADMIN', 'SALES', 'INVENTORY', 'AUDITOR'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export async function listTeam(): Promise<TeamData> {
  const res = await api.get<{ data: TeamData }>('/team');
  return res.data.data;
}

export async function inviteStaff(input: {
  fullName: string;
  email: string;
  roleName: StaffRole;
}): Promise<PendingInvite> {
  const res = await api.post<{ data: PendingInvite }>('/team/invites', input);
  return res.data.data;
}

export async function revokeInvite(id: string): Promise<void> {
  await api.delete(`/team/invites/${id}`);
}

export async function setMemberActive(id: string, isActive: boolean): Promise<TeamMember> {
  const res = await api.patch<{ data: TeamMember }>(`/team/members/${id}`, { isActive });
  return res.data.data;
}
