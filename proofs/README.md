# Onchain proofs

Live deployment and scenario proof collection is pending. No deployment address or successful receipt is claimed yet.

The fixed suite deploys two books and collects 23 receipts: terms compilation, atomic basket execution, exact reserve acceptance, insufficient reserve rejection, unauthorized calls, cancellation, reserve release through a reverse trade, a pending draft, mode-dependent settlement, quote invalidation and unknown-term blocking.

The verification scripts independently replay the complete credit ledger against full source-bound snapshots, actual call arguments, signer/target identities, deployed source bytes, finalized execution and strict majority votes. See [testing layers](../docs/TESTING.md).
