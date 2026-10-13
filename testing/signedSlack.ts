export const signingSecret = "test-signing-secret";

export type SigningOptions = { secret?: string; signedAt?: Date; contentType?: string };

export async function signedRequest(body: string, options: SigningOptions = {}): Promise<RequestInit> {
  const timestamp = Math.floor((options.signedAt ?? new Date()).getTime() / 1000).toString();
  const signature = await sign(options.secret ?? signingSecret, `v0:${timestamp}:${body}`);
  return {
    method: "POST",
    headers: {
      "content-type": options.contentType ?? "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": `v0=${signature}`,
    },
    body,
  };
}

async function sign(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Buffer.from(mac).toString("hex");
}
