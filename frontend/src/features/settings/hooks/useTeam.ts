import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listTeam,
  inviteStaff,
  revokeInvite,
  setMemberActive,
  type StaffRole,
} from '../api/team.api';

const teamKey = ['team'] as const;

export function useTeam() {
  return useQuery({ queryKey: teamKey, queryFn: listTeam });
}

export function useInviteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fullName: string; email: string; roleName: StaffRole }) =>
      inviteStaff(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey }),
  });
}

export function useSetMemberActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setMemberActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey }),
  });
}
