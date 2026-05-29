# Eval Cases

Store metadata only. Do not commit real customer artwork.

Use `artwork_ref` to point to a private/local/private-storage asset outside this repository.

Recommended fields:

```yaml
case_id: SKINCARE_001
category: Beauty / Skincare
language: Thai
artwork_ref: private://not-committed/SKINCARE_001.png
expected_focus:
  - Text Errors
  - Hierarchy
  - Readability
known_issues:
  - exact visible typo
  - possible watermark
  - product variant clarity risk
must_not_flag:
  - overall style
  - premium impression
  - general layout preference
```
