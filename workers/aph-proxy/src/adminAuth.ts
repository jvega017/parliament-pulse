// Admin token check (SEC-08). The old `header !== env.ADMIN_TOKEN` compare
// returned at the first differing character, so response timing could leak
// how much of a guessed token was right. Both sides are hashed with SHA-256
// first (equal-length digests, and the secret's length is not observable),
// then compared in constant time.

const enc = new TextEncoder();

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Constant-time string equality over SHA-256 digests of both inputs. */
export async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  // Workers expose crypto.subtle.timingSafeEqual; Node and other runtimes
  // do not, so fall back to an XOR accumulator over the whole digest.
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (x: ArrayBufferView | ArrayBuffer, y: ArrayBufferView | ArrayBuffer) => boolean;
  };
  if (typeof subtle.timingSafeEqual === "function") return subtle.timingSafeEqual(ha, hb);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

/**
 * True only when ADMIN_TOKEN is set and the supplied header matches it.
 * Fails closed: an unset or empty ADMIN_TOKEN rejects every request.
 */
export async function adminAuthorised(provided: string | null, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  return timingSafeEqualStr(provided ?? "", expected);
}
