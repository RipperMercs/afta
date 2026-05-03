import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import {
  hashRequest,
  hashResponse,
  tokenShort,
  generateReceiptId,
  loadSigningKey,
  signReceipt,
  verifyReceiptSignature,
} from "../src/receipts";
import type { ReceiptCore, PrivateJWK, PublicJWK } from "../src/types";

// Web Crypto is global in Node 20+, but vitest's environment may not bind
// it. Bind explicitly so tests run consistently.
if (typeof globalThis.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}

let privJwk: PrivateJWK;
let pubJwk: PublicJWK;

beforeAll(async () => {
  const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  privJwk = (await webcrypto.subtle.exportKey("jwk", privateKey)) as PrivateJWK;
  pubJwk = (await webcrypto.subtle.exportKey("jwk", publicKey)) as PublicJWK;
});

describe("hashRequest", () => {
  it("is stable across query param order", async () => {
    const a = await hashRequest("GET", new URL("https://x.com/p?b=2&a=1"));
    const b = await hashRequest("GET", new URL("https://x.com/p?a=1&b=2"));
    expect(a).toBe(b);
  });

  it("includes method (case-insensitive)", async () => {
    const a = await hashRequest("get", new URL("https://x.com/p"));
    const b = await hashRequest("GET", new URL("https://x.com/p"));
    expect(a).toBe(b);
  });

  it("differs by path", async () => {
    const a = await hashRequest("GET", new URL("https://x.com/a"));
    const b = await hashRequest("GET", new URL("https://x.com/b"));
    expect(a).not.toBe(b);
  });

  it("starts with sha256:", async () => {
    const h = await hashRequest("GET", new URL("https://x.com/p"));
    expect(h.startsWith("sha256:")).toBe(true);
  });
});

describe("hashResponse", () => {
  it("is order-independent for objects", async () => {
    const a = await hashResponse({ a: 1, b: 2 });
    const b = await hashResponse({ b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("differs by content", async () => {
    const a = await hashResponse({ a: 1 });
    const b = await hashResponse({ a: 2 });
    expect(a).not.toBe(b);
  });
});

describe("tokenShort", () => {
  it("preserves prefix and trims body", () => {
    const t = "tf_live_" + "a".repeat(64);
    const short = tokenShort(t);
    expect(short.startsWith("tf_live_")).toBe(true);
    expect(short).toContain("...");
    expect(short.length).toBeLessThan(t.length);
  });

  it("falls back to generic format without underscore prefix", () => {
    const t = "abcdefghijklmnopqrstuvwxyz";
    const short = tokenShort(t);
    expect(short).toContain("...");
  });

  it("returns short input unchanged", () => {
    expect(tokenShort("short")).toBe("short");
  });
});

describe("generateReceiptId", () => {
  it("starts with rcpt_ and is unique", () => {
    const a = generateReceiptId();
    const b = generateReceiptId();
    expect(a.startsWith("rcpt_")).toBe(true);
    expect(b.startsWith("rcpt_")).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("signReceipt + verifyReceiptSignature", () => {
  const baseCore: ReceiptCore = {
    v: 1,
    id: "rcpt_test1234",
    endpoint: "/api/premium/example",
    method: "GET",
    token_short: "tk_test...abcd",
    credits_charged: 1,
    credits_remaining: 99,
    request_hash: "sha256:abc",
    response_hash: "sha256:def",
    captured_at: "2026-05-03T00:00:00Z",
    server_time: "2026-05-03T00:00:01Z",
    no_charge_reason: null,
    freshness_sla_seconds: 1800,
  };

  it("produces a verifiable signature", async () => {
    const key = await loadSigningKey(privJwk);
    expect(key).not.toBeNull();
    const signed = await signReceipt({
      core: baseCore,
      signingKey: key!,
      verifyDoc: "https://example.com/agent-fair-trade#receipts",
    });
    expect(signed.signing_alg).toBe("EdDSA");
    expect(signed.signing_curve).toBe("Ed25519");
    expect(signed.canonical_form).toBe("afta-canonical-json-v1");
    const ok = await verifyReceiptSignature(signed, pubJwk);
    expect(ok).toBe(true);
  });

  it("rejects a tampered receipt", async () => {
    const key = await loadSigningKey(privJwk);
    const signed = await signReceipt({
      core: baseCore,
      signingKey: key!,
      verifyDoc: "https://example.com/v",
    });
    const tampered = { ...signed, credits_charged: 999 };
    const ok = await verifyReceiptSignature(tampered, pubJwk);
    expect(ok).toBe(false);
  });

  it("rejects a receipt signed by a different key", async () => {
    const otherPair = await webcrypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    );
    const otherPubJwk = (await webcrypto.subtle.exportKey(
      "jwk",
      otherPair.publicKey,
    )) as PublicJWK;
    const key = await loadSigningKey(privJwk);
    const signed = await signReceipt({
      core: baseCore,
      signingKey: key!,
      verifyDoc: "https://example.com/v",
    });
    const ok = await verifyReceiptSignature(signed, otherPubJwk);
    expect(ok).toBe(false);
  });

  it("loadSigningKey returns null for invalid input", async () => {
    expect(await loadSigningKey(null)).toBeNull();
    expect(await loadSigningKey(undefined)).toBeNull();
    expect(await loadSigningKey("not json")).toBeNull();
    expect(
      await loadSigningKey({
        kty: "OKP",
        crv: "Ed25519",
        d: "",
        x: "",
      } as PrivateJWK),
    ).toBeNull();
  });

  it("loadSigningKey accepts JWK as a JSON string", async () => {
    const key = await loadSigningKey(JSON.stringify(privJwk));
    expect(key).not.toBeNull();
  });
});
