export type SignUpResult =
  | { kind: 'success'; sessionEstablished: true }
  | { kind: 'no_session'; sessionEstablished: false; needsEmailConfirmation: true }
  | { kind: 'error'; error: string; isDuplicateEmail: boolean };

interface SupabaseSignUpResponse {
  error: { message: string } | null;
  session: unknown;
  user: unknown;
}

export function mapSignUpResult(res: SupabaseSignUpResponse): SignUpResult {
  if (res.error) {
    const msg = res.error.message.toLowerCase();
    const isDuplicate =
      msg.includes('already registered') ||
      msg.includes('already exists') ||
      msg.includes('already been registered') ||
      msg.includes('user already registered');
    return { kind: 'error', error: res.error.message, isDuplicateEmail: isDuplicate };
  }

  if (res.session) {
    return { kind: 'success', sessionEstablished: true };
  }

  if (res.user && !res.session) {
    return { kind: 'no_session', sessionEstablished: false, needsEmailConfirmation: true };
  }

  return {
    kind: 'error',
    error: 'Sign up completed but no account was returned. Please try again.',
    isDuplicateEmail: false,
  };
}

const FRIENDLY_ERRORS: { match: (m: string) => boolean; message: string }[] = [
  { match: m => m.includes('weak') || m.includes('pwned') || m.includes('easy to guess'), message: 'That password is too common. Please choose a stronger, unique password.' },
  { match: m => m.includes('already registered') || m.includes('already exists') || m.includes('already been registered') || m.includes('user already registered'), message: 'An account with this email already exists. Try signing in instead.' },
];

export function friendlyError(rawError: string): string {
  const lower = rawError.toLowerCase();
  for (const rule of FRIENDLY_ERRORS) {
    if (rule.match(lower)) return rule.message;
  }
  return rawError;
}

export const NO_SESSION_MESSAGE =
  'Check your email to verify your account. Click the verification link and you\u2019ll be signed in automatically and taken to your dashboard.';

export const SUCCESS_MESSAGE =
  'Account created! Taking you to your dashboard\u2026';

/**
 * Build the trusted email-redirect URL for the Supabase email-confirmation link.
 * Uses the current app origin plus /dashboard so the verification callback
 * returns to the app and lands on the Dashboard after the session is set.
 * For production this resolves to https://<your-velzico-production-domain>/dashboard.
 */
export function buildEmailRedirectTo(origin: string): string {
  return `${origin}/dashboard`;
}

export const CALLBACK_INVALID_MESSAGE =
  'This verification link is invalid or has expired. Please request a new verification email below, or sign in if you\u2019ve already confirmed your account.';

export type CallbackErrorState =
  | { kind: 'callback_error'; message: string }
  | { kind: 'none' };

/**
 * Inspect the current URL hash/query for Supabase email-verification error
 * params (e.g. #error=...&error_description=...). Supabase redirects to the
 * app with these params when a confirmation link is invalid or expired.
 * Returns a friendly message without exposing raw tokens or internal details.
 */
export function mapCallbackError(params: {
  error?: string | null;
  errorDescription?: string | null;
  errorCode?: string | null;
}): CallbackErrorState {
  const { error, errorDescription, errorCode } = params;

  if (!error && !errorDescription && !errorCode) {
    return { kind: 'none' };
  }

  return { kind: 'callback_error', message: CALLBACK_INVALID_MESSAGE };
}
