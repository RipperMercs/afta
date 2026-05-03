#!/usr/bin/env node
// Generate a fresh Ed25519 keypair for the AFTA receipt signing rail.
//
// Usage:
//   npx afta generate-key [--out=PATH]
//   node scripts/generate-receipt-key.mjs [--out=PATH]
//
// What it does:
//   1. Mints a fresh Ed25519 keypair (Web Crypto, no native deps)
//   2. Writes the PUBLIC JWK to the path given by --out (default:
//      ./public/.well-known/<publisher>-receipt-key.json if you pass
//      --publisher, otherwise ./receipt-key-public.json)
//   3. Prints the PRIVATE JWK on stdout for you to paste into your
//      runtime secret store
//
// Rotation: re-run this script, update the secret, ship the new public
// key. AFTA v1 ships single-key only.

import { webcrypto } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const args = process.argv.slice(2);
const opts = {};
for (const a of args) {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) opts[m[1]] = m[2];
}

const publisher = opts.publisher || "publisher";
const defaultOut = opts.publisher
  ? `./public/.well-known/${publisher}-receipt-key.json`
  : "./receipt-key-public.json";
const outPath = resolve(process.cwd(), opts.out || defaultOut);

const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
  { name: "Ed25519" },
  true,
  ["sign", "verify"],
);

const pubJwk = await webcrypto.subtle.exportKey("jwk", publicKey);
const privJwk = await webcrypto.subtle.exportKey("jwk", privateKey);

const xBytes = Buffer.from(
  pubJwk.x.replace(/-/g, "+").replace(/_/g, "/") + "==",
  "base64",
);
const digest = await webcrypto.subtle.digest("SHA-256", xBytes);
const hex = Array.from(new Uint8Array(digest))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
const kid = hex.slice(0, 16);

const verifyDoc = opts["verify-doc"] || `https://${publisher}/agent-fair-trade#receipts`;

const publicEnriched = {
  ...pubJwk,
  kid,
  use: "sig",
  alg: "EdDSA",
  verify_doc: verifyDoc,
};
const privateEnriched = {
  ...privJwk,
  kid,
  use: "sig",
  alg: "EdDSA",
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(publicEnriched, null, 2) + "\n", "utf8");

console.log("");
console.log("AFTA receipt keypair generated.");
console.log("");
console.log("Public JWK written to:");
console.log("  " + outPath);
console.log("");
console.log("Key id (kid): " + kid);
console.log("");
console.log("=== PRIVATE JWK (set as RECEIPT_PRIVATE_KEY_JWK in your secret store) ===");
console.log("");
console.log(JSON.stringify(privateEnriched));
console.log("");
console.log("Do NOT commit the private JWK. Recommended secret stores:");
console.log("  Cloudflare Workers:  wrangler secret put RECEIPT_PRIVATE_KEY_JWK");
console.log("  Vercel / Railway:    add as env var RECEIPT_PRIVATE_KEY_JWK");
console.log("  AWS / GCP:           secret manager + inject into runtime env");
console.log("");
