import { describe, it, expect } from "vitest";
import { buildManifest } from "../src/manifest";
import type { AdopterConfig } from "../src/types";

const minConfig: AdopterConfig = {
  publisher: {
    name: "Example.com",
    url: "https://example.com",
    contact: "contact@example.com",
  },
  self_description:
    "Example.com is agent fair-trade certified: open pricing, automatic no-charge on 5xx, breaker, schema fail, and stale data, Ed25519-signed receipts on every paid call, inference-only license.",
  freshness_slas: "https://example.com/api/meta",
  receipts: {
    public_key_url: "https://example.com/.well-known/example-receipt-key.json",
    verify_doc: "https://example.com/agent-fair-trade#receipts",
  },
  pricing: {
    listed_at: "https://example.com/api/payment/info",
  },
  data_license: { type: "inference-only" },
};

describe("buildManifest", () => {
  it("produces a manifest with all required top-level fields", () => {
    const m = buildManifest(minConfig, { lastUpdated: "2026-05-03" });
    expect(m.$schema).toBeDefined();
    expect(m.version).toBe("1.0");
    expect(m.publisher).toEqual(minConfig.publisher);
    expect(m.self_description).toBe(minConfig.self_description);
    expect(m.lastUpdated).toBe("2026-05-03");
  });

  it("supplies default no_charge_guarantees if none given", () => {
    const m = buildManifest(minConfig);
    const guarantees = m.no_charge_guarantees as Array<{ id: string }>;
    expect(guarantees.map((g) => g.id).sort()).toEqual(
      ["5xx", "circuit_breaker", "schema_validation_failure", "stale_data"],
    );
  });

  it("uses custom no_charge_guarantees if provided", () => {
    const m = buildManifest({
      ...minConfig,
      no_charge_guarantees: [
        { id: "custom_only", description: "test" },
      ],
    });
    const guarantees = m.no_charge_guarantees as Array<{ id: string }>;
    expect(guarantees).toHaveLength(1);
    expect(guarantees[0].id).toBe("custom_only");
  });

  it("includes the canonical_form id in receipts block", () => {
    const m = buildManifest(minConfig);
    const receipts = m.receipts as Record<string, unknown>;
    expect(receipts.canonical_form).toBe("afta-canonical-json-v1");
    expect(receipts.algorithm).toBe("EdDSA");
    expect(receipts.curve).toBe("Ed25519");
  });

  it("sets pricing.transparent: true automatically", () => {
    const m = buildManifest(minConfig);
    const pricing = m.pricing as Record<string, unknown>;
    expect(pricing.transparent).toBe(true);
    expect(pricing.listed_at).toBe(minConfig.pricing.listed_at);
  });

  it("omits optional pricing fields when not provided", () => {
    const m = buildManifest(minConfig);
    const pricing = m.pricing as Record<string, unknown>;
    expect(pricing.currency).toBeUndefined();
    expect(pricing.network).toBeUndefined();
  });
});
