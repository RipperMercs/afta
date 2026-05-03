import { describe, it, expect } from "vitest";
import { canonicalJSON } from "../src/canonical";

describe("canonicalJSON", () => {
  it("sorts object keys lexicographically", () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJSON({ z: 1, a: 1, m: 1 })).toBe(
      '{"a":1,"m":1,"z":1}',
    );
  });

  it("preserves array order", () => {
    expect(canonicalJSON([3, 1, 2])).toBe("[3,1,2]");
  });

  it("recursively canonicalizes nested objects", () => {
    const a = canonicalJSON({ x: { b: 1, a: 2 }, y: [{ d: 1, c: 2 }] });
    const b = canonicalJSON({ y: [{ c: 2, d: 1 }], x: { a: 2, b: 1 } });
    expect(a).toBe(b);
  });

  it("emits no whitespace", () => {
    const out = canonicalJSON({ a: 1, b: [2, 3] });
    expect(out).toBe('{"a":1,"b":[2,3]}');
    expect(out).not.toMatch(/\s/);
  });

  it("encodes strings with standard JSON escaping", () => {
    expect(canonicalJSON('hello "world"')).toBe('"hello \\"world\\""');
    expect(canonicalJSON("line1\nline2")).toBe('"line1\\nline2"');
  });

  it("handles null, true, false", () => {
    expect(canonicalJSON(null)).toBe("null");
    expect(canonicalJSON(true)).toBe("true");
    expect(canonicalJSON(false)).toBe("false");
  });

  it("throws on non-finite numbers", () => {
    expect(() => canonicalJSON(NaN)).toThrow();
    expect(() => canonicalJSON(Infinity)).toThrow();
    expect(() => canonicalJSON(-Infinity)).toThrow();
  });

  it("throws on undefined and functions", () => {
    expect(() => canonicalJSON(undefined)).toThrow();
    expect(() => canonicalJSON(() => 1)).toThrow();
  });

  it("produces byte-identical output for equivalent objects", () => {
    const a = canonicalJSON({ a: 1, b: { x: 1, y: 2 } });
    const b = canonicalJSON({ b: { y: 2, x: 1 }, a: 1 });
    expect(a).toBe(b);
  });
});
