import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Badge } from '@/shared/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { toast } from '@/shared/ui/use-toast';
import { useAuth } from '@/app/providers';
import { isAxiosError } from 'axios';
import { useTeam, useInviteStaff, useRevokeInvite, useSetMemberActive } from '../hooks/useTeam';
import { STAFF_ROLES, type StaffRole, type TeamMember } from '../api/team.api';

const inviteSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email'),
  roleName: z.enum(STAFF_ROLES),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  ADMIN: 'Full access',
  SALES: 'POS & customers',
  INVENTORY: 'Catalogue & stock',
  AUDITOR: 'Read-only + reports',
};

function serverMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } })?.error?.message;
    if (msg) return msg;
  }
  return fallback;
}

export function TeamManager() {
  const { user } = useAuth();
  const { data, isLoading } = useTeam();
  const inviteMutation = useInviteStaff();
  const revokeMutation = useRevokeInvite();
  const activeMutation = useSetMemberActive();
  const [showInvite, setShowInvite] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { fullName: '', email: '', roleName: 'SALES' },
  });

  async function onInvite(values: InviteFormValues) {
    try {
      await inviteMutation.mutateAsync(values);
      reset();
      setShowInvite(false);
      toast({ title: 'Invite sent', description: `${values.email} will receive an email link.`, variant: 'success' });
    } catch (err) {
      toast({
        title: 'Failed to send invite',
        description: serverMessage(err, 'Please try again.'),
        variant: 'destructive',
      });
    }
  }

  async function onRevoke(id: string, email: string) {
    if (!confirm(`Revoke the invite for ${email}?`)) return;
    try {
      await revokeMutation.mutateAsync(id);
      toast({ title: 'Invite revoked', variant: 'success' });
    } catch (err) {
      toast({ title: 'Failed to revoke invite', description: serverMessage(err, ''), variant: 'destructive' });
    }
  }

  async function onToggleActive(member: TeamMember) {
    const deactivating = member.isActive;
    if (
      deactivating &&
      !confirm(`Deactivate ${member.fullName}? They will be signed out and unable to sign in.`)
    ) {
      return;
    }
    try {
      await activeMutation.mutateAsync({ id: member.id, isActive: !member.isActive });
      toast({
        title: deactivating ? 'Member deactivated' : 'Member reactivated',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Failed to update member',
        description: serverMessage(err, 'Please try again.'),
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const members = data?.members ?? [];
  const invites = data?.invites ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          People with access to this shop. Invited members sign in with an emailed code.
        </p>
        <Button onClick={() => setShowInvite((s) => !s)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite member
        </Button>
      </div>

      {showInvite && (
        <form
          onSubmit={handleSubmit(onInvite)}
          className="grid gap-3 rounded-md border bg-surface-2 p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Full name</Label>
            <Input id="invite-name" {...register('fullName')} placeholder="Jane Smith" />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" {...register('email')} placeholder="jane@shop.co.uk" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              {...register('roleName')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role} — {ROLE_DESCRIPTIONS[role]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className={member.isActive ? '' : 'text-muted-foreground'}>
                  {member.fullName}
                  {member.id === user?.id && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{member.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{member.roleName}</Badge>
                </TableCell>
                <TableCell>
                  {!member.isActive ? (
                    <Badge variant="secondary">Deactivated</Badge>
                  ) : member.pending ? (
                    <Badge variant="secondary">Invited</Badge>
                  ) : (
                    <Badge variant="default">Active</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {member.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleActive(member)}
                      disabled={activeMutation.isPending}
                    >
                      {member.isActive ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {invites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Pending invites</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invite.roleName}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRevoke(invite.id, invite.email)}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Revoke invite for ${invite.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
