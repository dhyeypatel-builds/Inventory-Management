declare global {
  namespace Express {
    interface Request {
      /** Populated by the auth middleware after JWT verification */
      user?: {
        id: string;
        email?: string;   // set by auth middleware; fetched from DB when needed
        role: string;
        permissions: string[];
        tenantId?: string; // tenant the user belongs to; absent for platform tokens
      };
    }
  }
}

export {};
