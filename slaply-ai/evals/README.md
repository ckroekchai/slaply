# Slaply Prompt Eval Loop

This is a lightweight manual prompt evaluation loop. It does not call external APIs by itself and must not include real customer artwork.

## Folder Structure

- `cases/` - metadata for eval cases using placeholder artwork references.
- `outputs/` - saved scan outputs by prompt version.
- `scorecards/` - human review scorecards.
- `CHANGELOG.md` - prompt change history and rationale.

## Manual Loop

1. Choose test artworks from a private/local source.
2. Create or update case metadata in `cases/` without committing the artwork.
3. Run scans with the current prompt version.
4. Save sanitized JSON outputs under `outputs/<prompt-version>/`.
5. Review each output with `scorecards/scorecard-template.md`.
6. Tag the failure pattern.
7. Update one prompt file when possible.
8. Run the same cases again.
9. Compare old vs new output before deploying.

## Failure Tags

- `false_positive` - AI flagged an issue that should not be flagged.
- `missed_issue` - AI missed a concrete visible issue.
- `bad_severity` - High/Medium/Low label is not appropriate.
- `bad_annotation` - marker is not on the exact visible issue.
- `scope_creep` - report becomes design critique or art direction.
- `overclaim` - report implies compliance, legal, print, manufacturing, or sales approval.
- `bad_tone` - wording is too harsh, vague, or not customer-facing.

## Pass Rule

Pass if the average score is at least 4.0 and there is no boundary safety failure.

Fail if there is any prohibited claim, broad redesign advice, or severe annotation mismatch.
