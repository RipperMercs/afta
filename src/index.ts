/**
 * AFTA - Agent Fair-Trade Agreement reference implementation.
 *
 * An open standard for API publishers fair to AI agents. Code-enforced
 * no-charge guarantees, Ed25519-signed receipts, transparent pricing,
 * inference-only license. Self-publish a /.well-known/agent-fair-trade.json
 * conforming to the schema. Adoption is the certification.
 *
 * Standard: https://tensorfeed.ai/agent-fair-trade
 * Schema:   https://tensorfeed.ai/.well-known/agent-fair-trade-schema.json
 */

export {
  canonicalJSON,
  CANONICAL_FORM_ID,
} from "./canonical.js";

export {
  hashRequest,
  hashResponse,
  tokenShort,
  generateReceiptId,
  loadSigningKey,
  signReceipt,
  verifyReceiptSignature,
} from "./receipts.js";

export {
  resolveSLA,
  checkStaleness,
  describeSLAs,
} from "./freshness.js";

export type { FreshnessSLA, FreshnessRegistry, StalenessCheck } from "./freshness.js";

export { buildManifest } from "./manifest.js";

export type {
  NoChargeReason,
  ReceiptCore,
  SignedReceipt,
  PrivateJWK,
  PublicJWK,
  AdopterConfig,
} from "./types.js";
