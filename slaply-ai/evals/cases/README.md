# Eval Cases

Store metadata only. Do not commit real customer artwork.

Use `artwork_ref` to point to a private/local/private-storage asset outside this repository.

Prefer the CSV templates in `../templates/` for active set management. Use per-case YAML files only when a case needs longer notes than a CSV row can hold.

Required fields follow `../schema/eval-case.schema.json`.

Example placeholder:

```yaml
case_id: SKINCARE_001
tier: case_bank
active: false
category: Beauty / Skincare
language: Thai
artwork_ref: private://not-committed/SKINCARE_001.png
artwork_storage: local_private
storage_owner: internal
source_project_ref: PROJECT_REF_PLACEHOLDER
expected_focus:
  - Text Errors
  - Hierarchy
  - Readability
known_issues:
  - issue_type: Text Errors
    anchor: visible typo
    location_hint: front label
    expected_behavior: Flag the concrete typo without inventing wording.
    severity_hint: Medium
must_not_flag:
  - broad_design_critique
  - premium_judgment
  - beauty_taste_comment
  - compliance_approval
  - print_ready_certification
  - sales_guarantee
privacy_status: private_artwork_not_committed
review_status: candidate
```
