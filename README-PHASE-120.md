# Phase 120 — Contract + Payment Foundation

This phase adds the commercial state after proposal acceptance without collecting payment-card data.

Flow:
Proposal -> Accept -> Contract -> Invoice -> Payment-ready

The payment provider is intentionally not faked. A later phase can attach Stripe (or another provider) to `payments`.
