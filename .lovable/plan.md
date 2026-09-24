# Illustration diagnostics and recovery

## Goal
Give administrators a reliable batch-level view of illustration failures and a safe recovery action that repairs only missing or failed pages.

## Implementation
- Extend illustration lifecycle records with structured diagnostic details for each batch and page: provider/model outcome, page status, storage path/upload result, persistence result, and credit debit/refund/bypass events.
- Keep diagnostic access admin-only through the existing role checks and row-level policies; never expose provider credentials or raw authorization data.
- Update `illustrate-story` so every generated page records actionable stages and persistence failures are returned as failures rather than marked ready.
- Add an explicit admin recovery mode that validates administrator access, reconstructs the canonical story/page inputs server-side, selects only pages without a usable completed image, and uses a fresh recovery key.
- Preserve completed illustrations and existing batch pricing: recovery after a previously charged partial batch will not charge again; a fully refunded or never-charged batch follows the existing debit/refund contract.
- Add an admin diagnostics page with batch filters, per-page details, storage/persistence/credit visibility, and a recover button disabled when nothing is recoverable or a recovery is running.
- Add focused tests for authorization, ownership, batch grouping, completed-page preservation, missing/failed-only retry, credit deduplication, persistence failures, and frontend recovery states.

## Verification
- Deploy the updated function and database policy changes.
- Verify ordinary users cannot open diagnostics or invoke admin recovery.
- Run a real recovery against a controlled story with a missing/failed page; confirm completed pages remain unchanged, the repaired image persists and renders after refresh, and credits are not charged twice.
- Run frontend tests, typecheck, production build, and the illustrated PDF regression flow.
