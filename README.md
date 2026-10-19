# VectorReserve

A standalone GenLayer clearing book for contingent credit claims. Consensus compiles a complete source-derived payout matrix; counterparty-accepted basket trades update actual positions and credit balances under an exact scenario reserve invariant. A separately acquired final report determines the settlement transfers.

**Deployed on gasless StudioNet, chain 61999:** [`0x8810a20Aa538c62365214C344B3BB380954050F5`](https://explorer-studio.genlayer.com/address/0x8810a20Aa538c62365214C344B3BB380954050F5). [Deployment](https://explorer-studio.genlayer.com/tx/0xf10bb21ff993861b0cf23ccf81c84660e9e98a32ea612160e0b9fff16b286d08) · [Two books and 23 verified receipts](proofs/README.md) · [Passing CI: 71 tests](https://github.com/gabrieladash123-bit/vector-reserve/actions/runs/39230325682) · [Ready-to-submit text](docs/submission.md).

## Mechanism

1. Deployment freezes two participant wallets, an initial credit allocation, issuer terms and 1–3 ordered report commitments.
2. Anyone compiles the terms. Leader and validators independently download full bytes, verify SHA-256 and derive every payout for both instruments in all three modes. Exact cell agreement plus a substantive source-anchor audit gates storage. Missing amounts are -1, never zero; any unknown blocks trading.
3. Either participant quotes a signed two-leg basket and total premium. The other wallet can accept atomically. Both accounts must retain enough credits to meet their maximum net obligation over **every contractual mode**. Quotes are checked against current positions when taken; they do not reserve collateral in advance.
4. The maker can cancel an open quote. Reversing a position through a new counterparty trade can release reserve headroom.
5. Anyone resolves the next fixed report. Drafts do not settle. A definitive mode realizes both portfolio payoffs, changes credit balances, clears positions and voids open quotes. Exhausted inconclusive reports instead block the book without pretending to settle it.

These are nonredeemable internal accounting credits. The contract holds or transfers no GEN, tokens or externally backed funds. It models a finite contractual payoff space, not real-world market risk, price discovery, implementation guarantees or delivery certification.

## Demonstration

| Step | Account 0 credits | Account 0 positions | Required reserve | Standalone reserve |
| --- | --- | --- | --- | --- |
| Initial | 10 | `[0,0]` | 0 | 0 |
| Sell one of each complementary claim for one total premium credit | 11 | `[-1,-1]` | 6 | 12 |
| Sell one additional calm claim for one credit | 12 | `[-2,-1]` | 12 | 18 |
| Attempt a further calm sale with no premium | unchanged | unchanged | Would require 18 | Rejected |
| Buy back one calm claim | 11 | `[-1,-1]` | 6 | 12 |
| Sell one additional other claim for two credits | 13 | `[-1,-2]` | 12 | 18 |
| Final report selects surge | **1** | `[0,0]` | 0 | 0 |

The other account ends with **19** credits; supply remains **20**. A final calm mode would instead produce **7/13**, so the consensus outcome materially affects transfers. A pending draft mentioning calm cannot settle the book.

## Interface

| Method | Effect |
| --- | --- |
| `compile_terms()` | Fetch and independently validate the frozen issuer terms; enter OPEN or REVIEW |
| `quote([calm_quantity, other_quantity], premium)` | Participant posts a basket; positive quantities are sold by the maker, negative quantities are bought |
| `take(index)` | The other participant accepts; transfer premium and both position legs atomically after reserve checks |
| `cancel(index)` | Maker cancels its own open quote |
| `resolve()` | Fetch the next fixed report; wait, block, or realize settlement transfers |
| `get_state()` | Read source evidence, credits, signed positions, reserve diagnostics, quotes and complete trade history |

Positive premium moves credits **from taker to maker**; negative premium reverses that transfer. If quantity is `q`, the maker's position changes by `-q` and the taker's by `+q`. Quote indices are zero-based and remain stable.

## Verify

```sh
pip install -r requirements-dev.txt
genvm-lint download --version v0.2.16
genvm-lint check contracts/vector_reserve.py --json
python -m pytest tests/direct -q
node scripts/check-scenarios.cjs
```

The 71 direct tests explicitly replay validators, cover all three settlement modes, and include 50,176 payoff/position checks plus 96 sequential proposed trades. A cross-language test replays the entire CLI proof plan against real direct-VM snapshots before deployment.

- [Pinned contract](contracts/vector_reserve.py)
- [Protocol, invariant and trust boundaries](docs/architecture.md)
- [Tests and verification layers](docs/TESTING.md)
- [Synthetic issuer terms and reports](records)
- [Deployment and scenario proofs](proofs/README.md)

The repository is a fixed source authority. Hashes establish byte commitments, not truthful reports. The example reports are public in advance, wallets are test actors and credit units are not money. See the architecture document for liveness, model and application-integration limitations.
