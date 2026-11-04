/**
 * Business details shown on the legal and support pages. Set them at build time
 * (GitHub → Settings → Variables, or a local .env):
 *   VITE_SUPPORT_EMAIL     support / account-deletion inbox
 *   VITE_GRIEVANCE_NAME    Grievance Officer's name (India IT Rules 2021)
 *   VITE_LEGAL_NAME        the person or company operating Bazaar
 *   VITE_LEGAL_ADDRESS     postal address for notices
 * Until they are set, the pages show clearly marked placeholders.
 */
const env = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

export const LEGAL = {
  appName: 'Bazaar',
  operator: env(import.meta.env?.VITE_LEGAL_NAME, '[Operator name — set VITE_LEGAL_NAME]'),
  address: env(import.meta.env?.VITE_LEGAL_ADDRESS, 'Kolkata, West Bengal, India'),
  supportEmail: env(import.meta.env?.VITE_SUPPORT_EMAIL, 'support@example.com'),
  grievanceOfficer: env(import.meta.env?.VITE_GRIEVANCE_NAME, '[Grievance Officer — set VITE_GRIEVANCE_NAME]'),
  updated: '4 November 2026',
};

export const legalConfigured =
  !LEGAL.operator.startsWith('[') && LEGAL.supportEmail !== 'support@example.com';
