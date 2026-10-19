# VectorReserve protocol

## Boundary

A fixed two-wallet book trades two contingent claims over three exhaustive contractual modes: calm, surge and offline. Participants authorize actual basket trades; the contract maintains their credit balances, signed positions and worst-case obligations. These are nonredeemable contract-native test credits, not GEN, tokens, money, legal debt or verified service delivery.

The contract acquires complete commit-pinned issuer terms itself. GenLayer leader and validators independently derive all six payoff cells, including explicit zeroes and unknowns, then validators audit the leader's source anchors. No caller supplies payoff numbers. Unknown terms block the whole book. The two accounts have no administrative power to override these source-derived decisions.

After compilation, either wallet can quote a signed two-leg basket and total premium. Only the other wallet can accept. The premium transfer and both position changes happen atomically after checking the complete resulting portfolios. Quote creation reserves nothing; execution always rechecks current balances, so an old quote can become unfillable. The maker can cancel only its own open quote.

A positive premium moves credits from taker to maker; a negative premium moves them in the other direction. For each quoted quantity q, maker position decreases by q and taker position increases by q. Both directions are therefore explicitly authorized by the quote and its counterparty acceptance. Current credits must remain nonnegative; future positive payoffs cannot finance an overdraft.

Reports are fixed and ordered at deployment. Each resolve call fetches the next complete report. Leader and validators independently determine finality and exact mode; validators also audit source support. Drafts and ambiguities do not move credits. A definitive final mode realizes the actual portfolio payoffs, clears positions and voids remaining quotes. Exhausting the bounded report list without a definitive mode blocks further trading and leaves balances/positions unresolved.

## Mathematical invariant

For account i and state s, its contingent payoff is `P_i(s) = sum(position_i[j] * payout[j][s])`.

Required reserve is `R_i = max(0, -min_s P_i(s))`. Every accepted trade requires `credits_i >= R_i` for both accounts. Therefore `credits_i + P_i(s) >= 0` for **every contractual state**, not merely the predicted or likely state. Positions sum to zero by instrument and credits sum to the fixed endowment. Settlement preserves the same total supply. There are no withdrawals or external liabilities.

This is exhaustive finite-state collateral accounting. It is not CME SPAN, Value-at-Risk, a forecast, a probabilistic loss bound or real-world market solvency. The general idea of evaluating a portfolio across scenarios is established; see [CME's methodology overview](https://www.cmegroup.com/solutions/risk-management/performance-bonds-margins/span-methodology-overview.html). This implementation's states are its complete contractual payoff space, not sampled market shocks.

## Distinct mechanism

The authoritative state is a bilateral signed-position and credit ledger. Counterparty acceptance changes both sides' exposures. Global scenario netting can admit a basket that a sum of standalone reserves would reject. Subsequent trades can consume or release headroom. Definitive source consensus causes actual zero-sum credit transfers rather than merely changing a status.

The primitive has no owner-controlled graph proposal, graph versions, ballots, committee counting, certificates or redemption lifecycle. It is an accounting/clearing mechanism with two different consequential semantic inputs: the complete payout matrix and the final settlement mode.

## Trust and limitations

The repository and series are immutable authority boundaries. SHA-256 verifies committed bytes, not truthfulness. Documents can be synthetic, misleading or incomplete; common model errors remain possible despite independent checks. Modes are mutually exclusive and exhaustive **by contract**, not a claim that all real-world possibilities are modeled. Unknown is never silently interpreted as zero or finality.

Source reports are already public in the examples. The book does not promise hidden outcomes, fair execution timing, price discovery, liquidity, liquidation, external backing, deposits, withdrawals or recovery from unresolved evidence. A missing participant cannot be forced to trade. Users of a real application must define custody, source authority and real-world enforcement separately.

Bounds: two admitted wallets; two instruments; three modes; 1–3 ordered reports; 12 total quotes; per-leg quoted quantity -3..3, accumulated position -6..6; premium -10..10; per-unit payout 0..9; initial per-wallet credits 1..50; 16,000 fetched bytes and 1–12 clauses per document.

Either participant can exhaust the 12-quote lifetime cap; cancellation does not free quote capacity. This limits availability, not the reserve or conservation invariant. No claim of adversarial-participant liveness is made.
