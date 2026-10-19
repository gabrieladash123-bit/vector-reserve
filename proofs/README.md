# Onchain proofs

The [successful CLI deployment workflow](https://github.com/gabrieladash123-bit/vector-reserve/actions/runs/39230325834) deployed two books on **gasless StudioNet, chain 61999**, a simulation network. These are not Bradbury or mainnet deployments. Source SHA-256: `54b4e4313f4123406bc1c4f92705f80d61f845bc8f6d33c9c535606acfdb633b`. Source/fixture commit: `f69e150808504b11170ee1f34efb97f6850f5c17`; workflow execution revision: `11f340774c71a61da82ee4f80834d50b44309089`.

The suite contains **23 distinct FINALIZED / MAJORITY_AGREE receipts: 17 successful executions and six expected ERROR executions**. Vote counts below are **agree/disagree/idle**, including the leader. Idle votes remain in the majority denominator and are never counted as agreement. Two encrypted disposable participants and a third outsider exercise real signature authorization; they are test actors, not independent people.

## Deployed books

| Book | Contract | Deployment | Final state |
| --- | --- | --- | --- |
| Complete terms, signed trades and settlement | [`0x8810a20Aa538c62365214C344B3BB380954050F5`](https://explorer-studio.genlayer.com/address/0x8810a20Aa538c62365214C344B3BB380954050F5) | [5/0/0](https://explorer-studio.genlayer.com/tx/0xf10bb21ff993861b0cf23ccf81c84660e9e98a32ea612160e0b9fff16b286d08) | [SETTLED: credits 1/19, zero remaining positions](clearing-final-state.json) |
| Missing offline payoff | [`0x9a356D23CBc1dbF4f2a7Aa99794C95314B305eCD`](https://explorer-studio.genlayer.com/address/0x9a356D23CBc1dbF4f2a7Aa99794C95314B305eCD) | [3/0/2](https://explorer-studio.genlayer.com/tx/0x74457faef3211b75b3e4d51d8f4ed549d0e56f7867cae8a9b59a22cb14f01513) | [REVIEW: original 10/10 credits, no trades](uncertain-terms-final-state.json) |

## Consequential scenarios

| Scenario | Verified effect | Transaction | Votes | Snapshot |
| --- | --- | --- | --- | --- |
| Compile all six payout cells | `[[6,0,0],[0,6,6]]`; explicit zeroes preserved | [Compile](https://explorer-studio.genlayer.com/tx/0x9a5b220db838038a6120f6b507dd87be6e09134c63600cee5f1157345a8173eb) | 3/0/2 | [State](clearing-compile.json) |
| Accept complementary basket | Seller credits 11; net required reserve 6; standalone reserve 12 | [Take](https://explorer-studio.genlayer.com/tx/0xb6d07d55c54ed47f146b1ffa0a915ee2d609bf65e1935d1a900f48ddf2c54575) | 3/0/2 | [State](clearing-basket-take.json) |
| Accept exact reserve boundary | Seller credits 12, required reserve 12, headroom zero | [Take](https://explorer-studio.genlayer.com/tx/0xbd6bebee0038f5e1350c1e38c24b7b5b8638fd1ef401ed9b234461cfc0f59047) | 3/0/2 | [State](clearing-boundary-take.json) |
| Reverse one calm claim | Required reserve returns to 6 and headroom to 5 | [Take](https://explorer-studio.genlayer.com/tx/0xc12b16f9887bfff0e3abc8be9e54bc40eeda8226a9cc20843ae259fbef602bb8) | 3/0/2 | [State](clearing-cover-take.json) |
| Draft discusses calm, final choice undecided | PENDING/UNKNOWN; credits and positions unchanged; next report remains available | [Resolve](https://explorer-studio.genlayer.com/tx/0xa5c384c5f3e8d046b0f71672ae6c52316559acb4774239f27a9ed80095f63bb7) | 3/0/2 | [State](clearing-draft-pending.json) |
| Final report selects surge, rejecting earlier calm forecast | Positions `[-1,-2]/[1,2]` realize -12/+12; credits 13/7 become **1/19**; positions clear; resting quote becomes VOID | [Settlement](https://explorer-studio.genlayer.com/tx/0xfa95a492f5d93c0d4c775ba704e88cbd0bdfd55b8d067e43cbc8d000900f16cf) | 3/0/2 | [State](clearing-final-settlement.json) |
| Unknown offline amount | Store -1 rather than invent zero; REVIEW blocks trading | [Compile](https://explorer-studio.genlayer.com/tx/0xcf5efda92d1f405591e463f5c9752d03f1dc90d58614c8104587aeb1f11f20ab) | 3/0/2 | [State](uncertain-terms-compile.json) |

The final mode matters economically within this accounting model: calm would yield **7/13**, while the independently agreed surge mode yields **1/19**. The contract realizes the latter transfers, preserves total supply 20 and retires the actual exposures. It does not merely attach a status to a caller-supplied summary.

All six quotes and four accepted trades, including premiums and actual participant signers, appear in the [complete clearing trace](clearing-trace.json). The [uncertain-terms trace](uncertain-terms-trace.json) records its blocked quote. [The transaction journal](transactions.json) enumerates all 23 distinct hashes.

## Expected rejection proofs

Each row finalized MAJORITY_AGREE with execution ERROR and preserved its entire prior state. These are successful rejection checks, not successful trade executions. The fresh verifier checks the raw tagged UserError bytes from each actual receipt.

| Rejection | Transaction | Votes | Exact error |
| --- | --- | --- | --- |
| Outsider posts a quote | [Receipt](https://explorer-studio.genlayer.com/tx/0x39f8bd4f5c0e73a6d92b90e9d6cb4d682cf23a8353b54f2c9ac08cdc05952f70) | 5/0/0 | Participant only |
| Maker accepts its own quote | [Receipt](https://explorer-studio.genlayer.com/tx/0x093b52f463c3edeffd05e6483ed8b9c1cb6f0ad6d85f7c6dceb902ad0f13069b) | 4/0/1 | Counterparty acceptance required |
| New position requires 18 credits against 12 available | [Receipt](https://explorer-studio.genlayer.com/tx/0xeda101e9127d67709cdf2d5c5cc0025dbababb66a4b1f49ec71bd36d43dadb79) | 5/0/0 | Insufficient scenario reserve |
| Non-maker cancels | [Receipt](https://explorer-studio.genlayer.com/tx/0xeeadd7751d907a95cfe5e067423820c79f428dfafd0c44452ff0a0037cae4eba) | 3/0/2 | Maker only |
| Quote after settlement | [Receipt](https://explorer-studio.genlayer.com/tx/0x3a853044847bd12f210d3cf519f806875ced45e84e5cac9a67b86d037c5b7dda) | 3/0/2 | Book not open |
| Quote under unresolved terms | [Receipt](https://explorer-studio.genlayer.com/tx/0x9bc626d30ff08e8f14c5a4f1e61c7aad1a8872bfb1e5ca5c7b037804e9b91a25) | 5/0/0 | Book not open |

## Reproduce

[Fresh verification](verification.json) · [Hosted verification](cloud-verification.json) · [Deployment parameters and source records](suite.json) · [71 local direct tests](local-direct-tests.xml) · [71 hosted direct tests](cloud-direct-tests.xml) · [Passing CI](https://github.com/gabrieladash123-bit/vector-reserve/actions/runs/39230325682).

The verification scripts replay the complete ledger against full source-bound snapshots, decoded actual constructor/call arguments, signer/target identities, exact deployed source bytes, finalized execution and strict majority votes. An independent JavaScript oracle enumerates minimum safe initial credits for all three modes instead of copying the contract's maximum-loss calculation. The local fresh verifier additionally binds every rejection reason to its live receipt bytes.

For fresh read-only verification set `GENLAYER_CLI_PATH` to the installed `genlayer/dist/index.js` and optionally set `VECTOR_ACCOUNT` to an existing local CLI account. Run `node scripts/verify-proofs.cjs`. Add `--offline` to check downloaded artifacts without network. No disposable participant private key is needed. See [testing layers](../docs/TESTING.md) for the 50,176 risk cases, 96 sequential trade attempts and explicit validator replay coverage.

Issuer terms and reports are synthetic. All amounts are nonredeemable contract-native credits, with no GEN/token backing or external payment. The proof establishes source consensus and conservation within the contractual payoff space; it does not verify physical harbor conditions, fair prices or delivery of a service. Provider configuration is removed from receipts; source bytes, execution results, call data and raw votes are preserved.
