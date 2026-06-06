// Vite injects env vars via `import.meta.env`. This module isolates that
// Vite-specific syntax so it can be cleanly mocked in Jest (which runs as
// CommonJS and cannot evaluate `import.meta`). See jest.config.ts moduleNameMapper.
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
