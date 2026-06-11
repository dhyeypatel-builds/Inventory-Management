-- Auth hardening (security audit 2026-06-11)
--  1. Time-based lockout: users + platform admins get locked_until; platform
--     admins gain a failed_logins counter (users already had one).
--  2. Invite tokens are stored hashed (sha256 hex). Existing raw tokens are
--     hashed in place so already-emailed invite links keep working.

-- 1a. Users: time-based lockout marker
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);

-- 1b. Platform admins: lockout counter + marker
ALTER TABLE "platform_admins" ADD COLUMN "failed_logins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_admins" ADD COLUMN "locked_until" TIMESTAMP(3);

-- 2. Invites: token -> token_hash (sha256 hex of the raw token)
ALTER TABLE "invites" ADD COLUMN "token_hash" TEXT;
UPDATE "invites" SET "token_hash" = encode(sha256("token"::bytea), 'hex');
ALTER TABLE "invites" ALTER COLUMN "token_hash" SET NOT NULL;
ALTER TABLE "invites" DROP COLUMN "token";
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");
