// Supabase Edge Function invocations report a generic message on the returned
// error, while the real explanation lives in the HTTP response body. This digs
// that message out, falling back gracefully when the body isn't JSON.

interface FunctionErrorLike {
  message?: string;
  context?: { json?: () => Promise<{ error?: string }> };
}

export async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const err = error as FunctionErrorLike;
  try {
    const body = await err.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // response body wasn't JSON — fall through to error.message
  }
  return err.message || fallback;
}
