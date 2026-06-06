/**
 * Phase 2A transitional anchor: the well-known default tenant that all Phase 1
 * data belongs to (see the `multitenancy_foundation` migration). Used while the
 * scoping extension is not yet active (Stage 1/2). Stage 3 replaces direct uses
 * of this constant with the request's `currentTenant()`.
 */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
