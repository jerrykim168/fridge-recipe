// Shared request-validation helpers for the auth routes. Kept intentionally
// simple (format checks only) — this mirrors the client-side regex in
// components/AuthDialog.tsx so client/server feedback stays consistent.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
