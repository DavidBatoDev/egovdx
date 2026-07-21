# Elton build status

Updated after end-to-end unification.

## Unified

- **LGU onboarding:** PSA-backed lookup and registration, duplicate protection,
  officer authorization, immediate officer-to-LGU binding, refreshed session,
  and the deliberate zero-service dashboard.
- **eGOV PAY:** documented custom auth and HMAC contract, deterministic request
  transaction IDs, full/partial/zero-fee waiver handling, persisted checkout,
  callback and citizen-triggered reconciliation, and `/pay/[requestId]`.
- **Approval queue:** LGU/office scoping, verified-evidence review, paid/waived
  guard, rejection notes, and an atomic approval claim.
- **Issuance orchestration:** LGU/year control-number sequence, immutable PDF,
  honest chain source, resumable retries, issued-document persistence, and a
  chronological audit trail.
- **eMessage:** one issuance notification with E.164 normalization, stored
  delivery status/source, and a noted manual retry for failed or uncertain SMS.
- **Analytics:** LGU-scoped request count, completion rate, median issuance time,
  paid fees, waived count, and an honest no-data state.

## Verification

- Migration `004_elton_transaction_pipeline.sql` is applied and its request
  columns, control sequence table, and approval RPC are present.
- The Elton integration suite covers payment, waiver, ownership denial,
  approval, idempotent re-approval, PDF/chain/SMS, rejection, queue, and analytics.
- Headed local browser QA covers citizen payment, one-click officer issuance,
  and analytics. Production QA passes officer issuance, citizen tracking, and
  signed-out public verification.
- Earl's focused 21-check suite remains green after issuance refactoring.

## Controlled live status

The configured eGOV PAY token is a test token, but `EGOV_PAY_MODE` remains
`mock`: the controlled create-transaction requests returned `422` with an
invalid-digest error. Production eMessage is live and its controlled proof was
accepted using the configured approved test number; QA never targets the
request's citizen number. All Elton-owned application routes and persistence
work are complete. The Pay certification is an external contract follow-up,
not missing application implementation.

## Integration boundary

Jasmin's eGovPH shell, `/apply`, and `/track` now call Elton's payment and
officer contracts end to end. Ownership remains separate; integration no longer
blocks either member.
