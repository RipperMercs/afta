/**
 * AFTA canonical JSON.
 *
 * Deterministic JSON serialization used as the input to receipt signatures.
 * Required so a verifier can reconstruct the exact bytes the signer signed,
 * regardless of how their JSON library happens to serialize. Object keys are
 * sorted lexicographically; arrays preserve order; no whitespace; standard
 * JSON escaping; NaN, Infinity, undefined, and functions throw.
 *
 * The canonical form identifier shipped with v1 of the AFTA standard is
 * `afta-canonical-json-v1`. Receipts produced by this package set
 * `canonical_form` to that value so verifiers know which serialization to
 * apply when re-hashing.
 */

export const CANONICAL_FORM_ID = "afta-canonical-json-v1";

export function canonicalJSON(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalJSON: non-finite number not allowed");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts = keys.map(
      (k) => JSON.stringify(k) + ":" + canonicalJSON(obj[k]),
    );
    return "{" + parts.join(",") + "}";
  }
  throw new Error(`canonicalJSON: unsupported value type ${typeof value}`);
}
