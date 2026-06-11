-- Marks tokens consumed by rotation (vs logout/suspend revocation) so that
-- reuse within the grace window can be told apart from a stolen token.
ALTER TABLE "refresh_tokens" ADD COLUMN "replaced_by_id" TEXT;
