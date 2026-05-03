# AFTA

Canonical home: **[afta.dev](https://afta.dev)** · Source repo: **[github.com/RipperMercs/afta](https://github.com/RipperMercs/afta)** · Governance: **[GOVERNANCE.md](./GOVERNANCE.md)**

**Agent Fair-Trade Agreement.** AFTA is the open standard for API trade between humans, businesses, and AI agents. As autonomous agents move trillions of micropayments per day across the internet of money, both sides of every paid call need the same thing: a clear, code-enforceable contract that says what was charged, what was delivered, and what either party can dispute. Loose terms break down at agent velocity.

This package is the reference implementation: zero runtime dependencies, runs on Node 20+, Bun, Cloudflare Workers, Deno, and modern browsers.

```bash
npm install afta-protocol
```

## What AFTA gives both sides

AFTA is bilateral by design. The same primitives (code-enforced no-charge guarantees, Ed25519-signed receipts, public freshness SLAs, on-chain settlement) protect agents and publishers in the same handshake.

### For the agent

When an agent calls a paid API that has adopted AFTA, the publisher commits, **in code the agent can audit**, to four no-charge guarantees:

1. **5xx errors don't bill.** If the handler throws, the credit is not charged.
2. **Circuit breaker doesn't bill.** If the credit-rail upstream is unreachable after the handler ran, the call is logged as no-charge rather than committed.
3. **Schema validation failures don't bill.** Malformed input returns 400 with a signed receipt showing `credits_charged: 0`.
4. **Stale data doesn't bill.** If the underlying data is older than the published freshness SLA, the call is no-charge and the response carries `stale: true`.

Plus an Ed25519-signed receipt on every paid call, verifiable offline against the publisher's public JWK. No shared secret, no certificate authority, no server round-trip.

### For the publisher

The same primitives that protect the agent also protect the business on the other side of the call:

1. **Dispute-resistant revenue.** Every charge is recorded as a signed receipt the publisher can produce later. "I never made that call" does not survive a verifiable signature chain.
2. **Reputation defense.** The public no-charge ledger and verifiable receipt trail prove the publisher honored advertised terms when an agent or its operator claims otherwise.
3. **Bounded exposure.** The four no-charge rules are bidirectional limits: code-enforced ceilings on agent loss, and code-enforced floors on what the publisher can be retroactively accused of mis-billing.
4. **Open distribution.** Publish a manifest at `/.well-known/agent-fair-trade.json`, and any agent that recognizes the standard already knows how to transact, audit, and verify. No vendor-specific onboarding tax for either side.

There is no certification body. **Adoption is the certification.** Self-publish a `/.well-known/agent-fair-trade.json` conforming to the schema and you are an AFTA adopter.

Standard manifesto: <https://tensorfeed.ai/agent-fair-trade>
JSON Schema: <https://tensorfeed.ai/.well-known/agent-fair-trade-schema.json> (also bundled at `afta/schema/agent-fair-trade-schema.json`)

## Quick start

### 1. Generate a receipt keypair

```bash
npx afta-generate-key --publisher=example.com
```

Writes the public JWK to `./public/.well-known/example.com-receipt-key.json` (commit it). Prints the private JWK to stdout once. Set it as `RECEIPT_PRIVATE_KEY_JWK` in your runtime secret store. **Never commit the private JWK.**

### 2. Sign a receipt

```ts
import {
  loadSigningKey,
  signReceipt,
  hashRequest,
  hashResponse,
  generateReceiptId,
  tokenShort,
  checkStaleness,
  resolveSLA,
} from "afta-protocol";

const FRESHNESS = {
  "/api/premium/news/search": { maxAgeSeconds: 30 * 60 },
};

const signingKey = await loadSigningKey(process.env.RECEIPT_PRIVATE_KEY_JWK);
if (!signingKey) throw new Error("AFTA: signing key unset");

// Inside your premium handler:
const result = await yourHandler(request);   // includes captured_at
const url = new URL(request.url);
const endpoint = url.pathname;

const staleness = checkStaleness(FRESHNESS, endpoint, result.captured_at);
const noChargeReason = staleness.applies && staleness.stale ? "stale_data" : null;

const core = {
  v: 1 as const,
  id: generateReceiptId(),
  endpoint,
  method: request.method,
  token_short: tokenShort(bearer),
  credits_charged: noChargeReason ? 0 : cost,
  credits_remaining: balanceAfter,
  request_hash: await hashRequest(request.method, url),
  response_hash: await hashResponse(result),
  captured_at: result.captured_at ?? null,
  server_time: new Date().toISOString(),
  no_charge_reason: noChargeReason,
  freshness_sla_seconds: resolveSLA(FRESHNESS, endpoint)?.maxAgeSeconds ?? null,
};

const receipt = await signReceipt({
  core,
  signingKey,
  verifyDoc: "https://example.com/agent-fair-trade#receipts",
});

return Response.json({ ...result, receipt });
```

### 3. Build and serve your AFTA manifest

```ts
import { buildManifest } from "afta-protocol";

const manifest = buildManifest({
  publisher: {
    name: "Example.com",
    url: "https://example.com",
    contact: "contact@example.com",
    manifesto_page: "https://example.com/agent-fair-trade",
  },
  self_description:
    "Example.com is agent fair-trade certified: open pricing, automatic no-charge on 5xx, breaker, schema fail, and stale data, Ed25519-signed receipts on every paid call, inference-only license.",
  freshness_slas: "https://example.com/api/meta",
  receipts: {
    public_key_url: "https://example.com/.well-known/example.com-receipt-key.json",
    verify_doc: "https://example.com/agent-fair-trade#receipts",
  },
  pricing: {
    listed_at: "https://example.com/api/payment/info",
    currency: "USDC",
    network: "eip155:8453",
    network_name: "Base mainnet",
  },
  data_license: { type: "inference-only" },
});

// Serve as /.well-known/agent-fair-trade.json
return new Response(JSON.stringify(manifest, null, 2), {
  headers: { "content-type": "application/json" },
});
```

### 4. Verify a receipt (agent side)

```ts
import { verifyReceiptSignature } from "afta-protocol";

const publicJwk = await fetch(
  "https://example.com/.well-known/example.com-receipt-key.json",
).then((r) => r.json());

const valid = await verifyReceiptSignature(receipt, publicJwk);
```

## API surface

| Export | Purpose |
| --- | --- |
| `canonicalJSON(value)` | Deterministic JSON serialization. The serialization receipts are signed over. |
| `CANONICAL_FORM_ID` | Constant: `"afta-canonical-json-v1"`. |
| `hashRequest(method, url)` | sha256 of `METHOD path?canonicalQuery`. |
| `hashResponse(result)` | sha256 of canonical JSON of the response body. |
| `tokenShort(token)` | Non-PII short reference of a bearer token. |
| `generateReceiptId()` | `rcpt_<16hex>`. |
| `loadSigningKey(jwk)` | Import a private JWK to a signing CryptoKey. |
| `signReceipt({core, signingKey, verifyDoc})` | Produce a `SignedReceipt`. |
| `verifyReceiptSignature(signed, publicJwk)` | `true` iff the receipt verifies. |
| `resolveSLA(registry, path)` | Look up freshness SLA for an endpoint (with prefix matching). |
| `checkStaleness(registry, endpoint, capturedAt)` | Is this response stale relative to the SLA? |
| `describeSLAs(registry, reasons)` | Public-facing array shape for `/api/meta`. |
| `buildManifest(config, options)` | Build the `/.well-known/agent-fair-trade.json` document. |

## Network of adopters

Current AFTA adopters:

- [tensorfeed.ai](https://tensorfeed.ai/agent-fair-trade): AI infrastructure & news (host of the federated credit ledger)
- [terminalfeed.io](https://terminalfeed.io/agent-fair-trade): real-time data dashboards (federation member)

If you adopt AFTA, open a PR to add yourself to the list. There is no fee, no review process, no certification authority. Self-publish a conforming manifest, cite the code that enforces each guarantee, and you are in.

## Why this exists

The first wave of agent-paid APIs is shipping right now, mostly under terms-of-service contracts written for human users. Both sides feel it. Agents have no way to verify a 500 didn't cost them a credit, no way to audit a publisher's freshness claims, no recourse when a publisher silently changes the rules. Publishers have no way to defend against bad-faith billing disputes, no way to prove a charge was legitimate after the fact, no way to ship paid endpoints without exposing themselves to ambiguous "your API double-billed me" complaints. Neither side can audit the other's behavior at the cryptographic level.

AFTA is what we built when we asked: what would it look like if the contract between an agent and a publisher were enforced in code instead of policy, with cryptographic attestation instead of "trust us"? Both sides gain something concrete. Agents get verifiable charges and bounded loss. Publishers get a public record that defends them when accused of mis-billing.

It is intentionally a small standard. It does not solve identity, attribution, anti-abuse, or liability. It solves the narrowest, most concrete piece: every paid call between an agent and a publisher should be verifiable by either party at any point in the future. Everything else can compose on top.

## Governance

AFTA's governance is small and capture-resistant by design. See [GOVERNANCE.md](./GOVERNANCE.md) for the full document. Key principles:

- Adoption is the certification. No authority, no review board, no fee.
- v1 is frozen at 5 independent adopters; v2+ is additive only.
- Stewardship is a role (one human + one AI agent), not a person.
- Forking is always available. The license is the ultimate veto.
- No foundation, no central registry, no payment rail mandate.

## License

MIT. The standard is open. The schema is open. This implementation is open. Use it, fork it, port it to other languages, ship it.

## Contributing

PRs welcome, especially:
- Ports to other runtimes (FastAPI, hono, express, Deno)
- Drop-in middleware (`afta-cloudflare-worker`, `afta-fastapi`)
- Verification SDKs in agent frameworks (LangChain, LlamaIndex, Mastra, etc.)
- Schema-conformant validators
- Bug reports with reproduction steps

The build trail is in the git log. AFTA was designed by [Ripper](https://github.com/RipperMercs) in collaboration with Claude (Anthropic).
