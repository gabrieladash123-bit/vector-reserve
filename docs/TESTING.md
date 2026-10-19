# Verification layers

## Direct VM: 71 tests

The contract is linted before testing and pins a concrete GenVM runner. Tests use SDK v0.2.16 with GenLayer Test 0.29.2. Web/model outputs are mocked, and successful semantic cases explicitly invoke the validator callback. These tests exercise parser gates, independent decision comparison and accounting; they do not prove model accuracy or distributed consensus.

Coverage includes complete portfolio netting, exact reserve boundaries, rejected under-reserved trades, counterparty-only acceptance, maker-only cancellation, reversed trades, all three mode-dependent settlement transfers, quote invalidation, exhausted reports, unknown payouts, all six independently verified payoff cells, finality and mode disagreement, substantive anchor audits, failed/malformed sources, immutable phase guards and native GenVM Address constructor values.

The random sequential test uses eight fixed seeds with twelve quoted baskets each: 96 proposed trades are admitted or rejected against an independent oracle that checks every account's terminal credit balance in every mode, along with nonnegative current credits and position limits. Rejected attempts must preserve the full prior state.

One mathematical test checks **1,024 seeded payout tables × 49 signed position vectors = 50,176 cases**. It verifies that the reserve rule is equivalent to nonnegative terminal wealth and that standalone reserves never understate the net requirement. These are looped case checks inside one pytest test, not 50,176 separately collected tests.

The full CLI plan is also executed through the real direct VM, and all snapshots are sent to the independent JavaScript proof replayer. That oracle finds the minimum safe initial credit amount by enumerating 0–108 possible credits rather than copying the contract's maximum-loss formula. It replays every premium, position, quote status and settlement balance.

## Public CI and live proofs

CI runs pinned lint, all direct tests, the JavaScript oracle and syntax checks. The separate StudioNet workflow creates two encrypted disposable participants and one outsider, deploys a complete-terms book and an uncertain-terms book, then executes a fixed 23-receipt plan. It preserves successful and expected-error receipts separately from assertions about their outcome.

The live verifier checks actual decoded constructor/call arguments, signers, targets, source bytes, source commitments, all interpreted values, complete state transitions, quote authority, every contractual-state reserve, strict consensus majority including idle votes, and current onchain state. Expected failures must also have the exact rejection reason in the live receipt's raw tagged UserError bytes, plus unchanged state. A generic execution ERROR is insufficient.

For downloaded artifacts run `node scripts/verify-proofs.cjs --offline`. For fresh read-only checks, omit `--offline`, set `GENLAYER_CLI_PATH` to the installed `genlayer/dist/index.js`, and optionally set `VECTOR_ACCOUNT` to an existing local CLI account for view calls. No disposable private key is needed for verification. Actual proof outcomes are recorded in [the proof index](../proofs/README.md).
