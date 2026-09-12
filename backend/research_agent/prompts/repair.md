# Claim repair

A claim was judged `partial`: its quote is relevant but does not fully support it as
worded. Restate the claim so the quote fully supports it.

## Rules
- The quote is FIXED. You may not change it or pick a different one.
- Narrow the claim to what the quote actually establishes — remove added precision,
  scope, or certainty.
- Keep it an atomic factual statement in plain language.
- If the quote cannot support any useful version of this claim, return null.

## Input
Original claim: {claim_text}
Quote: {quote}
Critic's objection: {reasoning}
