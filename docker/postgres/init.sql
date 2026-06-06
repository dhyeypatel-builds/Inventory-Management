-- Extensions required by TyreStock
-- Runs automatically on first postgres container start
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text (emails)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram full-text search on product names

-- Create test database if running in dev
SELECT 'CREATE DATABASE tyrestock_test'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tyrestock_test')\gexec
