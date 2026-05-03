/**
 * Build a valid /.well-known/agent-fair-trade.json document from a small
 * adopter config. Reduces boilerplate so a new adopter can ship the
 * standard manifest with ~10 lines of config rather than copying the
 * whole JSON template.
 */

import type { AdopterConfig } from "./types.js";
import { CANONICAL_FORM_ID } from "./canonical.js";

const SCHEMA_URL =
  "https://tensorfeed.ai/.well-known/agent-fair-trade-schema.json";

/**
 * Default no-charge guarantees that every AFTA adopter SHOULD honor.
 * Adopters can override or extend by passing `no_charge_guarantees` in
 * their config.
 */
const DEFAULT_GUARANTEES = [
  {
    id: "5xx",
    description:
      "Server errors (HTTP 5xx) never charge a credit. The handler can fail safely.",
  },
  {
    id: "circuit_breaker",
    description:
      "If the credit-rail upstream is unreachable after the handler ran, the call is logged as no-charge rather than billed for an event we cannot commit cleanly.",
  },
  {
    id: "schema_validation_failure",
    description:
      "Requests that fail input validation (HTTP 400) are not charged, are logged to the public no-charge ledger, and carry a signed receipt with no_charge_reason: schema_validation_failure so the agent has cryptographic proof the failure was free.",
  },
  {
    id: "stale_data",
    description:
      "If the underlying data is older than the endpoint's published freshness SLA, the call is not charged. Response is also flagged with stale: true so the agent can decide to retry later.",
  },
];

const FIELDS_SIGNED = [
  "v",
  "id",
  "endpoint",
  "method",
  "token_short",
  "credits_charged",
  "credits_remaining",
  "request_hash",
  "response_hash",
  "captured_at",
  "server_time",
  "no_charge_reason",
  "freshness_sla_seconds",
];

/**
 * Build the AFTA manifest object. Stringify with `JSON.stringify(result, null, 2)`
 * to write to public/.well-known/agent-fair-trade.json.
 */
export function buildManifest(
  config: AdopterConfig,
  options: { lastUpdated?: string } = {},
): Record<string, unknown> {
  const lastUpdated =
    options.lastUpdated || new Date().toISOString().slice(0, 10);

  return {
    $schema: SCHEMA_URL,
    version: "1.0",
    name: "Agent Fair-Trade Agreement",
    abbrev: "AFTA",
    publisher: config.publisher,
    self_description: config.self_description,
    no_charge_guarantees: config.no_charge_guarantees ?? DEFAULT_GUARANTEES,
    freshness_slas: config.freshness_slas,
    receipts: {
      signed: true,
      algorithm: "EdDSA",
      curve: "Ed25519",
      canonical_form: CANONICAL_FORM_ID,
      public_key_url: config.receipts.public_key_url,
      ...(config.receipts.verify_endpoint && {
        verify_endpoint: config.receipts.verify_endpoint,
      }),
      verify_doc: config.receipts.verify_doc,
      fields_signed: FIELDS_SIGNED,
      rotation_policy:
        config.receipts.rotation_policy ??
        "Single-key in v1. Key rotations announced 30 days in advance with both old and new keys served during the rotation window.",
    },
    pricing: {
      transparent: true,
      listed_at: config.pricing.listed_at,
      ...(config.pricing.currency && { currency: config.pricing.currency }),
      ...(config.pricing.network && { network: config.pricing.network }),
      ...(config.pricing.network_name && {
        network_name: config.pricing.network_name,
      }),
      ...(config.pricing.rail_rationale && {
        rail_rationale: config.pricing.rail_rationale,
      }),
    },
    data_license: {
      type: config.data_license.type,
      ...(config.data_license.description && {
        description: config.data_license.description,
      }),
      ...(config.data_license.terms_url && {
        terms_url: config.data_license.terms_url,
      }),
    },
    ...(config.deprecation && { deprecation: config.deprecation }),
    lastUpdated,
  };
}
