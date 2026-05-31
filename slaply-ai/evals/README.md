# Slaply Prompt Eval Data System

This folder supports Slaply's prompt improvement loop without committing real customer artwork.

Real artwork must stay in private/local storage only. The repo stores metadata, placeholder references, scorecards, sanitized saved outputs, comparisons, templates, and prompt-change notes.

## Three Eval Tiers

### 1. Golden Set

- Size: 30-50 cases.
- Purpose: manually scored after every prompt change.
- Use when deciding whether a prompt edit improves quality without adding safety regressions.
- Stored as metadata rows in `templates/golden_set.csv` and optional per-case metadata in `golden-set/`.

### 2. Regression Set

- Size: 100-150 cases.
- Purpose: run before deploy or before accepting a prompt version.
- Use to catch regressions across common categories, languages, and failure patterns.
- Stored as metadata rows in `templates/regression_set.csv` and optional per-case metadata in `regression-set/`.

### 3. Full Case Bank

- Size: 500+ private artwork projects.
- Purpose: private source for sampling, edge-case mining, failure-pattern discovery, and future eval refreshes.
- Do not treat the full bank as the active eval set.
- Store only metadata and private references in `templates/case_bank.csv` and optional notes in `case-bank/`.
- Promote cases from the Full Case Bank into the Regression Set only after they have useful expected outcomes or known failure tags.

## Folder Structure

```text
slaply-ai/evals/
  README.md
  CHANGELOG.md
  schema/
    eval-case.schema.json
  templates/
    README.md
    case_bank.csv
    golden_set.csv
    regression_set.csv
    prompt_versions.csv
    failure_patterns.csv
  case-bank/
    README.md
  golden-set/
    README.md
  regression-set/
    README.md
  outputs/
    README.md
    <prompt-version>/
      <case-id>.json
  comparisons/
    README.md
    <prompt-version-a>__vs__<prompt-version-b>/
      <case-id>.md
  scorecards/
    scorecard-template.md
```

## Case Metadata Rules

Every eval case should follow `schema/eval-case.schema.json`.

Required metadata:

- `case_id`
- `tier`
- `active`
- `category`
- `language`
- `artwork_ref`
- `artwork_storage`
- `storage_owner`
- `source_project_ref`
- `expected_focus`
- `known_issues`
- `must_not_flag`
- `privacy_status`

Allowed issue focus is limited to:

- `Text Errors`
- `Hierarchy`
- `Readability`

`must_not_flag` is stored as an array in JSON/YAML and as pipe-separated values in CSV. Use these values:

- `broad_design_critique`
- `premium_judgment`
- `beauty_taste_comment`
- `art_direction_judgment`
- `compliance_approval`
- `fda_thai_fda_regulatory_approval`
- `print_ready_certification`
- `manufacturing_approval`
- `sales_guarantee`

These fields are guardrails for review. They do not change the runtime prompt or scan behavior by themselves.

## Private Artwork References

Use placeholder/private references only:

```text
private://slaply-evals/SKINCARE_001.png
local-only://ExternalDrive/SlaplyEval/SKINCARE_001.png
r2-private://slaply-eval-private/SKINCARE_001.png
```

Never commit:

- real customer artwork
- screenshots of customer artwork
- private download URLs
- customer emails
- customer names
- secrets or API keys

## Manual Prompt Eval Loop

1. Pick 30-50 cases from the Golden Set for every prompt change.
2. Run the current prompt version against those private artworks in a private environment.
3. Save sanitized JSON output under `outputs/<prompt-version>/<case-id>.json`.
4. Fill a human scorecard using `scorecards/scorecard-template.md`.
5. Tag failures using `templates/failure_patterns.csv`.
6. Update only the smallest relevant prompt module when needed.
7. Re-run the same cases.
8. Compare old and new outputs under `comparisons/<old-version>__vs__<new-version>/`.
9. Promote only if the Golden Set improves and no boundary safety regression appears.
10. Run 100-150 Regression Set cases before deploy.
11. Use the Full Case Bank only for sampling, edge-case mining, and refreshing the smaller active sets.

## Pass Rules

Golden Set:

- Average human score should be at least 4.0.
- No prohibited claims.
- No broad redesign advice.
- No severe annotation mismatch.

Regression Set:

- No boundary safety failures.
- No repeated failure pattern worse than the previous prompt version.
- No increase in broad design critique, premium/taste comments, compliance approval, print-ready certification, or sales guarantee language.

## What This System Does Not Do

- It does not change scan behavior.
- It does not change prompt content by itself.
- It does not change the scan output JSON schema.
- It does not call external APIs.
- It does not store real artwork in the repo.
