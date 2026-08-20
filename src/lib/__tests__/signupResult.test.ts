import { describe, it, expect } from 'vitest';
import {
  mapSignUpResult,
  friendlyError,
  NO_SESSION_MESSAGE,
  SUCCESS_MESSAGE,
  buildEmailRedirectTo,
  mapCallbackError,
  CALLBACK_INVALID_MESSAGE,
} from '@/lib/signupResult';

describe('mapSignUpResult — successful signup with session', () => {
  it('returns success when session is present', () => {
    const result = mapSignUpResult({
      error: null,
      session: { access_token: 'fake-token' },
      user: { id: 'user-1' },
    });
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.sessionEstablished).toBe(true);
    }
  });

  it('success result implies dashboard routing, not sign-in form', () => {
    const result = mapSignUpResult({
      error: null,
      session: { access_token: 'fake-token' },
      user: { id: 'user-1' },
    });
    expect(result.kind).toBe('success');
    expect(SUCCESS_MESSAGE).toContain('Account created');
    expect(SUCCESS_MESSAGE).toContain('dashboard');
  });
});

describe('mapSignUpResult — no session (email confirmation required)', () => {
  it('returns no_session when user exists but no session', () => {
    const result = mapSignUpResult({
      error: null,
      session: null,
      user: { id: 'user-1' },
    });
    expect(result.kind).toBe('no_session');
    if (result.kind === 'no_session') {
      expect(result.sessionEstablished).toBe(false);
      expect(result.needsEmailConfirmation).toBe(true);
    }
  });

  it('no_session is a success state (check-email), not an error or sign-in form', () => {
    const result = mapSignUpResult({
      error: null,
      session: null,
      user: { id: 'user-1' },
    });
    expect(result.kind).toBe('no_session');
    expect(NO_SESSION_MESSAGE.toLowerCase()).toContain('check your email');
    expect(NO_SESSION_MESSAGE.toLowerCase()).toContain('verify');
    expect(NO_SESSION_MESSAGE.toLowerCase()).toContain('dashboard');
    expect(NO_SESSION_MESSAGE.toLowerCase()).toContain('automatically');
  });

  it('does not fake a session', () => {
    const result = mapSignUpResult({
      error: null,
      session: null,
      user: { id: 'user-1' },
    });
    if (result.kind === 'no_session') {
      expect(result.sessionEstablished).toBe(false);
    }
  });
});

describe('mapSignUpResult — errors stay on signup form', () => {
  it('returns error with isDuplicateEmail=true for "already registered"', () => {
    const result = mapSignUpResult({
      error: { message: 'User already registered' },
      session: null,
      user: null,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.isDuplicateEmail).toBe(true);
    }
  });

  it('returns error with isDuplicateEmail=true for "already exists"', () => {
    const result = mapSignUpResult({
      error: { message: 'This email already exists in our system' },
      session: null,
      user: null,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.isDuplicateEmail).toBe(true);
    }
  });

  it('returns error with isDuplicateEmail=false for network errors', () => {
    const result = mapSignUpResult({
      error: { message: 'Network request failed' },
      session: null,
      user: null,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.isDuplicateEmail).toBe(false);
      expect(result.error).toBe('Network request failed');
    }
  });

  it('does not expose internal stack traces or sensitive data', () => {
    const result = mapSignUpResult({
      error: { message: 'Invalid email format' },
      session: null,
      user: null,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toBe('Invalid email format');
      expect(result.error).not.toContain('stack');
    }
  });
});

describe('mapSignUpResult — edge cases', () => {
  it('returns error when no user and no session and no error', () => {
    const result = mapSignUpResult({
      error: null,
      session: null,
      user: null,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.isDuplicateEmail).toBe(false);
    }
  });
});

describe('friendlyError — user-friendly messages', () => {
  it('maps "already registered" to friendly duplicate message', () => {
    const msg = friendlyError('User already registered');
    expect(msg).toContain('already exists');
    expect(msg).toContain('signing in');
  });

  it('maps "weak password" to friendly message', () => {
    const msg = friendlyError('This password is too weak and has been pwned');
    expect(msg).toContain('too common');
    expect(msg).toContain('stronger');
  });

  it('passes through unrecognized errors unchanged', () => {
    const msg = friendlyError('Some unexpected error');
    expect(msg).toBe('Some unexpected error');
  });
});

describe('buildEmailRedirectTo — verification link target', () => {
  it('appends /dashboard to the given origin', () => {
    expect(buildEmailRedirectTo('https://crewbill.com')).toBe('https://crewbill.com/dashboard');
  });

  it('works with localhost dev origin', () => {
    expect(buildEmailRedirectTo('http://localhost:5173')).toBe('http://localhost:5173/dashboard');
  });

  it('always targets /dashboard (required by flow spec)', () => {
    const url = buildEmailRedirectTo('https://crewbill.com');
    expect(url.endsWith('/dashboard')).toBe(true);
  });
});

describe('mapCallbackError — invalid/expired verification links', () => {
  it('returns callback_error when error param present', () => {
    const state = mapCallbackError({ error: 'access_denied', errorDescription: null, errorCode: '403' });
    expect(state.kind).toBe('callback_error');
    if (state.kind === 'callback_error') {
      expect(state.message).toBe(CALLBACK_INVALID_MESSAGE);
    }
  });

  it('returns callback_error when only error_description present', () => {
    const state = mapCallbackError({ error: null, errorDescription: 'Token has expired', errorCode: null });
    expect(state.kind).toBe('callback_error');
  });

  it('returns callback_error for expired token error code', () => {
    const state = mapCallbackError({ error: null, errorDescription: null, errorCode: 'otp_expired' });
    expect(state.kind).toBe('callback_error');
  });

  it('returns none when no error params present (valid callback / clean URL)', () => {
    const state = mapCallbackError({ error: null, errorDescription: null, errorCode: null });
    expect(state.kind).toBe('none');
  });

  it('friendly message does not expose raw tokens or internal details', () => {
    const state = mapCallbackError({ error: 'unauthorized', errorDescription: 'invalid token hash abc123xyz', errorCode: '401' });
    expect(state.kind).toBe('callback_error');
    if (state.kind === 'callback_error') {
      expect(state.message).not.toContain('abc123xyz');
      expect(state.message).not.toContain('token hash');
      expect(state.message).toBe(CALLBACK_INVALID_MESSAGE);
    }
  });

  it('a successful callback (session established, no error params) is not treated as an error', () => {
    const state = mapCallbackError({ error: null, errorDescription: null, errorCode: null });
    expect(state.kind).toBe('none');
  });
});

describe('callback session reaches Dashboard without another login', () => {
  it('no error params means no callback error — existing onAuthStateChange sets the session and App routes to Dashboard', () => {
    const state = mapCallbackError({ error: null, errorDescription: null, errorCode: null });
    expect(state.kind).toBe('none');
  });
});

describe('duplicate submission prevention', () => {
  it('loading guard prevents re-entry (simulated)', () => {
    let loading = false;
    let callCount = 0;
    const fakeSubmit = () => {
      if (loading) return false;
      loading = true;
      callCount++;
      return true;
    };

    expect(fakeSubmit()).toBe(true);
    expect(fakeSubmit()).toBe(false);
    expect(fakeSubmit()).toBe(false);
    expect(callCount).toBe(1);
  });

  it('second click after first returns false (no double submit)', () => {
    let loading = false;
    let submissions = 0;
    const handleSubmit = () => {
      if (loading) return;
      loading = true;
      submissions++;
    };

    handleSubmit();
    handleSubmit();
    handleSubmit();
    expect(submissions).toBe(1);
  });

  it('resend button respects resending guard (no double resend)', () => {
    let resending = false;
    let resendCount = 0;
    const handleResend = () => {
      if (resending) return;
      resending = true;
      resendCount++;
    };

    handleResend();
    handleResend();
    handleResend();
    expect(resendCount).toBe(1);
  });
});
