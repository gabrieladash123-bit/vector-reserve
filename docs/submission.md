Category: **Builder → Intelligent Contracts**

Title: **VectorReserve: Consensus portfolio-reserve clearing**

Notes / Description:

> VectorReserve is a standalone GenLayer clearing book for contingent credits. Leader and validators independently fetch committed issuer terms, derive all six payout cells and audit source anchors. Unknown amounts block trading; missing payouts never become zero. Two wallets quote and accept atomic baskets. Each trade checks both full portfolios against every contractual mode, preserving supply and zero-sum positions. Ordered reports undergo independent finality/mode consensus; drafts do not settle. A definitive mode realizes credit transfers and clears exposures. StudioNet proofs cover complementary offsets, an exact reserve boundary, rejected excess, a reversing trade, a misleading draft, 1/19 settlement and unknown-term blocking. All 23 finalized receipts match actual calls and state; six are expected rejections. Includes 71 direct tests, 50,176 risk cases and 96 sequential trade attempts. Fixtures are synthetic and credits have no monetary backing.

Evidence:

- [Repository](https://github.com/gabrieladash123-bit/vector-reserve)
- [GenLayer contract source](https://github.com/gabrieladash123-bit/vector-reserve/blob/main/contracts/vector_reserve.py)
- [StudioNet contract explorer](https://explorer-studio.genlayer.com/address/0x8810a20Aa538c62365214C344B3BB380954050F5)
- [Deployment transaction](https://explorer-studio.genlayer.com/tx/0xf10bb21ff993861b0cf23ccf81c84660e9e98a32ea612160e0b9fff16b286d08)
- [Mode-dependent settlement transaction](https://explorer-studio.genlayer.com/tx/0xfa95a492f5d93c0d4c775ba704e88cbd0bdfd55b8d067e43cbc8d000900f16cf)
- [Both books and all proofs](https://github.com/gabrieladash123-bit/vector-reserve/blob/main/proofs/README.md)
- [Passing public CI](https://github.com/gabrieladash123-bit/vector-reserve/actions/runs/39230325682)
- [Passing deployment/proof workflow](https://github.com/gabrieladash123-bit/vector-reserve/actions/runs/39230325834)
