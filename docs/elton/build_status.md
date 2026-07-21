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
- Headed browser QA covers citizen payment, one-click officer issuance, and
  analytics.
- Earl's focused 21-check suite remains green after issuance refactoring.

## Controlled live status

The configured eGOV PAY token is a test token, but `EGOV_PAY_MODE` remains
`mock`. eMessage also remains `mock`, and no `EGOV_EMESSAGE_TEST_NUMBER` is
configured. No external transaction or SMS was created during automated QA.
Switch each integration independently only for the controlled live proof; never
send a QA notification to a citizen's production number.

These two controlled proofs are Elton's only remaining required tasks. All
owned application routes and persistence work are complete.

## Integration boundary

Jasmin's eGovPH shell, `/apply`, and `/track` now call Elton's payment and
officer contracts end to end. Ownership remains separate; integration no longer
blocks either member.
