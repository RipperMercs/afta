/**
 * AFTA receipt signing and verification.
 *
 * Every paid premium response under AFTA carries a JSON receipt signed with
 * an Ed25519 keypair. Agents verify against the publisher's public JWK
 * (served at `/.well-known/<publisher>-receipt-key.json` per convention)
 * with no shared secret, no central authority, and no certificate chain.
 *
 * Bootstrap a keypair with `node scripts/generate-receipt-key.mjs`. Hold
 * the private JWK in your runtime's secret store (Cloudflare Wrangler
 * secret, Doppler, AWS SSM, etc.) and serve the public JWK from your repo.
 *
 * If the signing key is unset this module degrades gracefully: signReceipt
 * returns null. Adopters SHOULD treat null as "do not advertise AFTA on
 * this response" rather than emitting unsigned receipts that imply trust
 * the publisher cannot back up.
 */

import { canonicalJSON, CANONICAL_FORM_ID } from "./canonical.js";
import type {
  PrivateJWK,
  PublicJWK,
  ReceiptCore,
  SignedReceipt,
} from "./types.js";

const enc = new TextEncoder();

// === SHA-256 helper ===

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// === Hashing helpers used to populate ReceiptCore ===

/**
 * Hash a request to a stable key. Uses METHOD + path + sorted query params.
 * Two requests with the same observable shape produce the same hash, which
 * is what agents need for receipt-level traceability.
 */
export async function hashRequest(
  method: string,
  url: URL,
): Promise<string> {
  const params: Array<[string, string]> = [];
  url.searchParams.forEach((v, k) => params.push([k, v]));
  params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const canonicalQuery = params.map(([k, v]) => `${k}=${v}`).join("&");
  const stringForm = `${method.toUpperCase()} ${url.pathname}?${canonicalQuery}`;
  return "sha256:" + (await sha256Hex(stringForm));
}

/**
 * Hash the response body the handler computed, BEFORE the receipt and
 * billing wrapper are added. Canonical JSON so the hash is reproducible
 * by a verifier.
 */
export async function hashResponse(result: unknown): Promise<string> {
  return "sha256:" + (await sha256Hex(canonicalJSON(result)));
}

// === Token short reference ===

/**
 * Produce a non-PII short reference of a bearer token for receipt
 * traceability. Preserves the prefix and last few chars; insufficient for
 * forgery, sufficient for log correlation.
 *
 * The default heuristic keeps any `<prefix>_` namespace plus last 8 chars
 * of the body. Adopters can pass a custom function if their tokens use a
 * different shape.
 */
export function tokenShort(token: string): string {
  if (!token || token.length < 16) return token;
  const underscore = token.indexOf("_");
  if (underscore > 0 && underscore < 16) {
    const prefix = token.slice(0, underscore + 1);
    const body = token.slice(underscore + 1);
    return `${prefix}${body.slice(0, 8)}...${body.slice(-8)}`;
  }
  return token.slice(0, 8) + "..." + token.slice(-4);
}

// === Random IDs ===

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateReceiptId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `rcpt_${bytesToHex(bytes)}`;
}

// === Key loading ===

interface LoadedKey {
  key: CryptoKey;
  kid: string;
}

/**
 * Import an Ed25519 private JWK (parsed object or JSON string) into a
 * non-extractable signing CryptoKey. Returns null if the input is invalid.
 *
 * The kid is taken from the JWK if present, otherwise computed as the
 * first 16 hex chars of SHA-256(public x). Stable across runtimes.
 */
export async function loadSigningKey(
  jwkInput: PrivateJWK | string | undefined | null,
): Promise<LoadedKey | null> {
  if (!jwkInput) return null;
  let parsed: PrivateJWK;
  if (typeof jwkInput === "string") {
    try {
      parsed = JSON.parse(jwkInput) as PrivateJWK;
    } catch {
      return null;
    }
  } else {
    parsed = jwkInput;
  }
  if (
    parsed.kty !== "OKP" ||
    parsed.crv !== "Ed25519" ||
    !parsed.d ||
    !parsed.x
  ) {
    return null;
  }
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      parsed as JsonWebKey,
      { name: "Ed25519" },
      false,
      ["sign"],
    );
  } catch {
    return null;
  }
  const kid = parsed.kid || (await sha256Hex(parsed.x)).slice(0, 16);
  return { key, kid };
}

// === Sign + verify ===

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface SignReceiptOptions {
  core: ReceiptCore;
  signingKey: LoadedKey;
  /** URL pointing at the publisher's verification documentation. */
  verifyDoc: string;
}

/**
 * Sign a receipt core. Throws nothing; returns the signed receipt.
 */
export async function signReceipt(
  opts: SignReceiptOptions,
): Promise<SignedReceipt> {
  const { core, signingKey, verifyDoc } = opts;
  const message = enc.encode(canonicalJSON(core));
  const sig = await crypto.subtle.sign(
    { name: "Ed25519" },
    signingKey.key,
    message as BufferSource,
  );
  return {
    ...core,
    signature: bytesToBase64Url(new Uint8Array(sig)),
    key_id: signingKey.kid,
    signing_alg: "EdDSA",
    signing_curve: "Ed25519",
    canonical_form: CANONICAL_FORM_ID,
    verify_doc: verifyDoc,
  };
}

/**
 * Verify a signed receipt against a public JWK. Returns true iff the
 * signature matches the canonical form of the core receipt fields. A
 * failed verification is just a boolean; verification doesn't expose why.
 */
export async function verifyReceiptSignature(
  signed: SignedReceipt,
  publicJwk: PublicJWK,
): Promise<boolean> {
  if (signed.canonical_form !== CANONICAL_FORM_ID) return false;
  const core: ReceiptCore = {
    v: signed.v,
    id: signed.id,
    endpoint: signed.endpoint,
    method: signed.method,
    token_short: signed.token_short,
    credits_charged: signed.credits_charged,
    credits_remaining: signed.credits_remaining,
    request_hash: signed.request_hash,
    response_hash: signed.response_hash,
    captured_at: signed.captured_at,
    server_time: signed.server_time,
    no_charge_reason: signed.no_charge_reason,
    freshness_sla_seconds: signed.freshness_sla_seconds,
  };
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      publicJwk as JsonWebKey,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch {
    return false;
  }
  const sigBytes = base64UrlToBytes(signed.signature);
  const message = enc.encode(canonicalJSON(core));
  try {
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      sigBytes as BufferSource,
      message as BufferSource,
    );
  } catch {
    return false;
  }
}
