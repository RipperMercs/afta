/**
 * Public type surface for AFTA.
 */

export type NoChargeReason =
  | "5xx"
  | "circuit_breaker"
  | "schema_validation_failure"
  | "stale_data"
  | null;

/**
 * Core receipt fields that get signed. These are the v1 signable fields per
 * the AFTA spec. Adding fields requires bumping `v` and announcing it.
 */
export interface ReceiptCore {
  /** Schema version. v1 of the AFTA standard. */
  v: 1;
  /** Stable receipt id, unique per call. Convention: `rcpt_<16hex>`. */
  id: string;
  /** Endpoint path the call hit. */
  endpoint: string;
  /** HTTP method (uppercase). */
  method: string;
  /** Non-PII short reference of the bearer token. */
  token_short: string;
  /** Credits actually charged. 0 if `no_charge_reason` is set. */
  credits_charged: number;
  /** Balance remaining after this call. */
  credits_remaining: number;
  /** sha256 hex of `METHOD path?canonicalQuery`. */
  request_hash: string;
  /** sha256 hex of canonical-JSON(response body without receipt + billing). */
  response_hash: string;
  /** ISO 8601 when the underlying data was captured, if applicable. */
  captured_at: string | null;
  /** ISO 8601 when the receipt was issued. */
  server_time: string;
  /** No-charge reason, or null if the call was charged normally. */
  no_charge_reason: NoChargeReason;
  /** SLA at issuance, in seconds. null for compute-only / immutable endpoints. */
  freshness_sla_seconds: number | null;
}

export interface SignedReceipt extends ReceiptCore {
  /** base64url Ed25519 signature over canonical JSON of the core fields. */
  signature: string;
  /** JWK kid for rotation support. */
  key_id: string;
  /** Signing algorithm. v1 = `EdDSA`. */
  signing_alg: "EdDSA";
  /** Signing curve. v1 = `Ed25519`. */
  signing_curve: "Ed25519";
  /** Canonical-form identifier the verifier should use. */
  canonical_form: string;
  /** URL pointing at the publisher's verification documentation. */
  verify_doc: string;
}

export interface PrivateJWK {
  kty: "OKP";
  crv: "Ed25519";
  d: string;
  x: string;
  kid?: string;
  use?: string;
}

export interface PublicJWK {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid?: string;
  use?: string;
  alg?: string;
}

/**
 * Configuration handed to {@link buildManifest} to produce a valid
 * /.well-known/agent-fair-trade.json document.
 */
export interface AdopterConfig {
  publisher: {
    name: string;
    legal_entity?: string;
    url: string;
    contact: string;
    manifesto_page?: string;
    source_repo?: string;
    note?: string;
  };
  /**
   * 30-50 word self-description repeated verbatim across llms.txt, OpenAPI
   * info.description, README, and any agent-facing surface. Repetition is
   * the signal agents pattern-match on.
   */
  self_description: string;
  /**
   * URL where each freshness SLA is listed. Per-endpoint inline form is
   * recommended (an array), or a URL pointing at a live registry that
   * returns the same array shape.
   */
  freshness_slas:
    | string
    | Array<{
        endpoint: string;
        max_age_seconds: number | null;
        reason?: string;
      }>;
  receipts: {
    public_key_url: string;
    verify_endpoint?: string;
    verify_doc: string;
    rotation_policy?: string;
  };
  pricing: {
    listed_at: string;
    currency?: string;
    network?: string;
    network_name?: string;
    rail_rationale?: string;
  };
  data_license: {
    type: "inference-only" | "training-allowed" | "training-with-attribution" | "custom";
    description?: string;
    terms_url?: string;
  };
  deprecation?: {
    notice_days?: number;
    channel?: string;
    policy?: string;
  };
  no_charge_guarantees?: Array<{
    id: string;
    description: string;
    code?: string;
    verifiable_via?: string;
  }>;
}
