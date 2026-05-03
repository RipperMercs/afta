/**
 * AFTA freshness SLA framework.
 *
 * Each premium endpoint declares a freshness commitment: how stale
 * underlying data is allowed to be before the response is no-charge.
 * If the data backing a response was captured longer ago than the SLA
 * permits, the bearer is not charged the credit for that call. The
 * receipt records `no_charge_reason: "stale_data"` and the response
 * carries a `stale: true` flag so the agent knows to retry later.
 *
 * `null` means "no freshness SLA applies." Two cases produce null:
 *   - Historical / immutable data (e.g. dated series queries): the
 *     answer for 2026-04-15 is the same forever.
 *   - Pure-compute endpoints (e.g. routing, cost projection): the
 *     answer is computed from current pricing, no captured-at concept.
 */

export interface FreshnessSLA {
  maxAgeSeconds: number;
}

export type FreshnessRegistry = Record<string, FreshnessSLA | null>;

/**
 * Resolve the SLA for a path that may be templated. Path-prefix matches
 * are accepted (e.g. `/api/premium/providers/anthropic` resolves via
 * `/api/premium/providers`).
 */
export function resolveSLA(
  registry: FreshnessRegistry,
  path: string,
): FreshnessSLA | null {
  if (path in registry) return registry[path];
  const segments = path.split("/").filter(Boolean);
  while (segments.length > 0) {
    segments.pop();
    const prefix = "/" + segments.join("/");
    if (prefix in registry) return registry[prefix];
  }
  return null;
}

export interface StalenessCheck {
  stale: boolean;
  ageSeconds: number | null;
  slaSeconds: number | null;
  capturedAt: string | null;
  /** false when SLA is null (immutable / compute-only). */
  applies: boolean;
}

/**
 * Check whether a response is stale relative to its endpoint's SLA.
 *
 * `capturedAt` should be the ISO 8601 timestamp the underlying data was
 * captured. Pass null when the response has no capture concept; the
 * helper marks the check as not-applicable and the caller should treat
 * that as "fresh" for billing.
 */
export function checkStaleness(
  registry: FreshnessRegistry,
  endpoint: string,
  capturedAt: string | null,
  now: Date = new Date(),
): StalenessCheck {
  const sla = resolveSLA(registry, endpoint);
  if (!sla) {
    return {
      stale: false,
      ageSeconds: null,
      slaSeconds: null,
      capturedAt,
      applies: false,
    };
  }
  if (!capturedAt) {
    // SLA applies but the handler didn't surface a captured_at. Be
    // conservative: treat as fresh (don't punish billing for missing
    // metadata) but the receipt will still record the SLA so verifiers
    // can see we ran the check.
    return {
      stale: false,
      ageSeconds: null,
      slaSeconds: sla.maxAgeSeconds,
      capturedAt: null,
      applies: true,
    };
  }
  const captured = Date.parse(capturedAt);
  if (!Number.isFinite(captured)) {
    return {
      stale: false,
      ageSeconds: null,
      slaSeconds: sla.maxAgeSeconds,
      capturedAt,
      applies: true,
    };
  }
  const ageSeconds = Math.max(
    0,
    Math.floor((now.getTime() - captured) / 1000),
  );
  return {
    stale: ageSeconds > sla.maxAgeSeconds,
    ageSeconds,
    slaSeconds: sla.maxAgeSeconds,
    capturedAt,
    applies: true,
  };
}

/**
 * Convenience for /api/meta or the AFTA manifesto. Returns the registry
 * as a serializable array with each entry's SLA in human-friendly form.
 */
export function describeSLAs(
  registry: FreshnessRegistry,
  reasons: Record<string, string> = {},
): Array<{ endpoint: string; max_age_seconds: number | null; reason: string }> {
  return Object.entries(registry).map(([endpoint, sla]) => ({
    endpoint,
    max_age_seconds: sla?.maxAgeSeconds ?? null,
    reason: reasons[endpoint] ?? "",
  }));
}
