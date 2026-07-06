// AES-GCM encryption helper for BYOK keys.
// The encryption key is derived via HKDF-SHA256 from BYOK_ENCRYPTION_KEY if set,
// otherwise from SUPABASE_SERVICE_ROLE_KEY (already a server-only secret).
// Output format is a compact "v1:<iv_b64>:<ciphertext_b64>" string.

const enc = new TextEncoder();
const dec = new TextDecoder();

let cachedKey: Promise<CryptoKey> | null = null;

async function deriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret =
    Deno.env.get("BYOK_ENCRYPTION_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";
  if (!secret) throw new Error("BYOK: no encryption secret available");
  cachedKey = (async () => {
    const ikm = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      "HKDF",
      false,
      ["deriveKey"],
    );
    return await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: enc.encode("byok-v1-salt"),
        info: enc.encode("user-api-keys"),
      },
      ikm,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  })();
  return cachedKey;
}

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptApiKey(plain: string): Promise<{
  ciphertext: string;
  iv: string;
  last4: string;
  fingerprint: string;
}> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plain),
  );
  const fp = await crypto.subtle.digest("SHA-256", enc.encode(plain));
  return {
    ciphertext: b64encode(ct),
    iv: b64encode(iv),
    last4: plain.slice(-4),
    fingerprint: b64encode(fp).slice(0, 16),
  };
}

export async function decryptApiKey(ciphertext: string, iv: string): Promise<string> {
  const key = await deriveKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(iv) },
    key,
    b64decode(ciphertext),
  );
  return dec.decode(pt);
}
