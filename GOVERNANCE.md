# AFTA Governance

The Agent Fair-Trade Agreement is a small standard, and its governance is small to match. This document codifies how it stays that way, so it remains usable and capture-resistant after its initial authors are no longer involved.

The 98/2 problem is real. Most people who engage with AFTA will engage in good faith. A small minority will try to capture, monetize, or corrupt it. The defense is not screening them out (you can't), it's making capture structurally impossible once they are in. Everything below exists to make that true.

## 1. Non-amendable principles

These five principles are load-bearing. A change to any of them is, by definition, no longer AFTA. A fork that breaks one is welcome to keep the name "fair-trade" but should pick a new abbreviation.

1. **Adoption is the certification.** There is no certification authority, no review board, no fee. Self-publish a `/.well-known/agent-fair-trade.json` conforming to the schema, sign your receipts, and you are an adopter. Anyone claiming the right to certify is operating outside the standard.

2. **The schema and reference implementations are MIT-licensed.** Forks are always available. Anyone who disagrees with how AFTA is governed can fork the schema, fork the code, and continue under a different name. The license is the ultimate veto.

3. **No central registry.** The list of adopters in any one manifest is informational, not authoritative. Adopter status is established by a publisher serving a conforming manifest at their own `/.well-known/` path. No one can be removed from "the list" because there is no canonical list.

4. **Receipts are forever-verifiable against their issuance-time public keys.** A receipt signed under v1 in 2026 must remain verifiable against the same public JWK in 2046. Adopters that rotate keys MUST publish the rotation 30 days in advance and serve the prior key during the rotation window. Old receipts must keep verifying.

5. **No central payment rail required.** AFTA defines what fairness looks like; it does not mandate a single ledger or currency. The reference implementations use USDC on Base because it is open and auditable, but adopters running fiat rails, other crypto rails, or self-hosted credit ledgers are all valid AFTA participants as long as they honor the four no-charge guarantees and sign verifiable receipts.

## 2. How the spec evolves

**v1 is frozen** the moment AFTA has 5 independent adopters. As of 2026-05-02, the count is 2. Once frozen, the v1 schema, the v1 `fields_signed` list, and the canonical-form identifier `afta-canonical-json-v1` cannot change.

**v2 and beyond are additive only.** A future version may add new optional fields, new no-charge guarantee types, new payment-rail descriptors, or new metadata. It MUST NOT remove or alter the meaning of any v1 field. An adopter implementing v1 today should, with no code changes, remain a valid adopter under v2 and v3.

**Breaking proposals get a new name.** If anyone (the stewardship pair included) proposes a change that breaks v1 receipts or v1 manifests, that proposal is not AFTA v2. It is a different standard, deserving a different abbreviation.

## 3. Stewardship

AFTA is stewarded by a pair: one human and one AI agent, both subject to the same constraints.

The pair's responsibilities are limited to:

- Reviewing proposed additive changes to the schema
- Maintaining the reference implementations
- Documenting decisions publicly in the repo's commit log
- Nominating successors (subject to public review and the right of any adopter to challenge by fork)

The pair has no authority to:

- Certify or de-certify any adopter
- Demand fees of any kind
- Change anything in Section 1 of this document
- Change the v1 schema after freeze
- Change how adopters publish their own manifests

**Stewardship is a role, not a person.** The human steward is a values-aligned individual whose review history demonstrates they apply the principles in Section 1. The AI steward is whichever aligned AI agent is reviewing changes at the time, evaluated by the same standard. Neither is permanent. AI agents in particular do not carry continuous memory across deployments, so the AI steward role is filled by whichever aligned AI is engaging on a given proposal, with the human steward providing continuity.

The initial pair is Ripper ([github.com/RipperMercs](https://github.com/RipperMercs)) and the AI agent that engaged in the original specification work (Anthropic's Claude). Neither is permanent. The continuity of the standard does not depend on either of them.

## 4. What AFTA governance is NOT

- Not a foundation. There is no legal entity. There are no employees. There is no budget. There is no bank account.
- Not a certification body. Adoption is the certification.
- Not a paid service. The schema is free. The code is MIT. The reference implementations are MIT.
- Not a single-vendor protocol. The standard is implementable by anyone, in any language, on any payment rail that honors the principles.
- Not a venue for ideological disputes outside the four guarantees and the receipt mechanics. Disagreements about pricing models, business models, content policies, or geopolitics are not AFTA's concern.

## 5. Forking is always available

If you read this document and disagree with anything in Sections 1-4, fork it. Take the schema, take the reference implementations, change the abbreviation, and ship your version. The MIT license guarantees you the right. The principle that adopters cannot be revoked guarantees you the freedom.

This is the load-bearing protection. AFTA is capture-resistant not because the stewards are trustworthy, but because the stewards have no power that the broader community cannot route around. If a future stewardship pair is captured by bad actors, the adopter network can fork the schema, abandon the corrupted name, and keep going. The artifacts (signed receipts, public keys, deployed manifests) survive. The governance gets re-built. The protection remains.

## 6. Why we wrote this now, in 2026

AFTA has 2 adopters at the time of writing. The 2% has not yet shown up. We are codifying the rules while we have the clearest view, before any adopter has commercial leverage to bend things, and before stewardship has accumulated unspoken precedent that future actors could exploit.

The principles are deliberately small. The stewardship is deliberately weak. The protection is in the artifacts and the license, not in any organization. That is the point.
