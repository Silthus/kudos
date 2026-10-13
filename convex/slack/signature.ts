const maxAgeSeconds = 5 * 60;

export type SignedRequest = { timestamp: string | null; signature: string | null; body: string };

export async function isSignedBySlack(request: SignedRequest, signingSecret: string, nowMs: number): Promise<boolean> {
  const { timestamp, signature, body } = request;
  if (timestamp === null || signature === null) return false;
  if (!isFresh(timestamp, nowMs)) return false;
  const mac = hexToBytes(signature.replace(/^v0=/, ""));
  if (mac === null) return false;
  const key = await hmacKey(signingSecret);
  return crypto.subtle.verify("HMAC", key, mac, new TextEncoder().encode(`v0:${timestamp}:${body}`));
}

function isFresh(timestamp: string, nowMs: number) {
  const signedAtSeconds = Number(timestamp);
  return Number.isInteger(signedAtSeconds) && Math.abs(nowMs / 1000 - signedAtSeconds) <= maxAgeSeconds;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
}
