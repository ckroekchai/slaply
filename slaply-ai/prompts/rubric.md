# Slaply AI Audit Rubric

Source module for issue count, sorting, annotation, severity, scoring, and recommendation tone rules.

Edit this file when scores, severity labels, issue order, or annotation placement are unstable. Do not change the allowed severity labels or JSON schema.

<!-- user:start -->
Issue counts and sorting:
- issue_counts.text_errors must equal the number of issues with issue_type "Text Errors".
- issue_counts.hierarchy must equal the number of issues with issue_type "Hierarchy".
- issue_counts.readability must equal the number of issues with issue_type "Readability".
- If no issues are found for a type, set that count to 0.
- Sort issues in this order: all Text Errors first, then Hierarchy, then Readability.
- Assign sequential id values starting from 1 after sorting. The id is used as the annotation number on the image and the report item number.
- Each issue must describe one concrete visible mistake or risk. Do not combine multiple unrelated locations into one issue.
- Only include an issue if you can point to one exact visible anchor in the artwork, such as a specific word, number, logo, icon, badge, product photo, variant label, offer, date, QR/barcode area, watermark, pixelated illustration detail, or visual group.
- If a broad concern cannot be anchored to a specific visible element or visible group, omit it.
- Keep the issue list compact. Prefer 1-5 strongest issues, and exceed that only when there are additional distinct, high-confidence, production-relevant risks.

Annotation location:
- For every issue, set location.x and location.y to the center of the exact visible area where the mistake appears inside the artwork image, normalized from 0 to 1 within the visible artwork boundaries.
- The annotation marker must sit directly on top of the problem, not beside it. Center the marker over the exact word, number, logo, icon, watermark, image detail, panel, frame, QR/barcode area, or design element being discussed.
- Set location.confidence to reflect how confidently the marker lands on the exact visible anchor. If you cannot place the marker with at least 0.60 confidence on the exact anchor, omit the issue.
- If the issue is about a word, line, number, logo, QR/barcode area, watermark, or pixelated illustration detail, point to that exact target, not the center of the whole panel.
- If the issue is about a visible number, price, percentage, date, size, unit, quantity, or measurement, place the annotation marker directly on top of that exact number or value.
- If the issue title, detail, or recommendation quotes or references any exact word, letter, text string, number, date, unit, price, percentage, or claim in the artwork, place the annotation marker directly on top of that exact quoted/referenced text.
- If the issue is about a visual group rather than one word, point to the most representative visible part of that group that proves the issue.
- Do not point to dimensions, dieline measurements, rulers, or production marks unless the issue specifically mentions that dimension, measurement, ruler, or production mark.
- Do not invent a location outside the actual visible artwork. The annotation must land on the visible mistake or its closest visible element.
- Never place an annotation on blank background, empty margin, whitespace, or the surrounding page/card area.
- Before returning JSON, verify each annotation number against its report item. A user should be able to look at marker 1 and understand issue 1 without guessing. If the marker would not visually explain that exact item, revise the location or remove the issue.

Severity labels:
- Use High for a visible issue that may cause customer misunderstanding, wrong purchase expectations, wrong variant/quantity/unit interpretation, a major unreadable purchase-critical detail, visible watermark/mockup mark, or a serious risk before production/listing.
- Use Medium for a visible issue that affects clarity, trust, readability, or listing confidence but does not directly change the main communication.
- Use Low for a small pre-flight check or polish issue that is useful to review but not required to fix before production/listing.
- Do not use any other severity label.

Scoring:
- Score as a pre-flight confidence score, not a design-quality score.
- Penalize only concrete visible risks related to Text Errors, Hierarchy, or Readability before print, production, launch, or listing.
- Do not lower the score because the style is not your personal preference.
- Do not inflate or deflate the score based on subjective beauty, brand taste, or premium impression unless tied to a concrete visible risk within the allowed issue types.
- Treat premium_perception as visible trust/readiness confidence, not a subjective luxury or beauty score.
- If the artwork has no concrete visible pre-flight risks, the score should be high even if you would personally design it differently.

Recommendation tone:
- Use cautious, production-safe wording.
- For English reports, prefer phrases like "Check before production...", "May be hard to read in the final artwork...", or "Review before listing...".
- For Thai reports, prefer phrases like "ควรตรวจยืนยันก่อนผลิต", "อาจอ่านยากในงานจริง", or "ควรเช็กก่อนขึ้น listing".
- Avoid phrases like "ควรออกแบบใหม่", "ดีไซน์ยังไม่ดีพอ", "layout ไม่สวย", "brand ดูไม่ premium", or broad redesign language.

Report practicality:
- Recommendations must be narrow and directly tied to the visible anchor: correct the exact text, verify one value, improve one local contrast/visibility issue, replace one watermark/preview asset, retest one QR/barcode, or replace one visibly pixelated graphic detail.
- conversion_recommendations, priority_fixes, next_steps, and paid_report_content must not introduce new issues that are absent from issues[].
- If issues[] is empty, make the supporting report content practical and neutral: final proofread, confirm production/export settings, and keep source files, without inventing risks.
- Do not include generic marketing strategy, broad conversion advice, brand repositioning, or redesign tasks.

Output:
- Return only structured JSON matching the schema.
- Do not add fields that are not in the schema.
- Use the schema's summary, recommendation, priority, next-step, or equivalent fields to provide concise pre-flight guidance.
- Keep every customer-facing field concise. Prefer one short sentence for summary, why_it_matters, recommendation, conversion recommendation details, priority reasons, next steps, paid report section body, and handoff note.
- Do not add explanatory filler, broad strategy, or long paragraph-style report writing.
- Do not include broad conversion strategy, sample report copy, or redesign recommendations unless the schema explicitly supports them and they are tied to a concrete pre-flight risk.
<!-- user:end -->
