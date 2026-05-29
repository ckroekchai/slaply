# Slaply AI Audit Issue Library

Source module for issue definitions and detection/omission rules.

Edit this file when Slaply repeatedly misses or over-flags a specific issue type. Keep all issues inside the existing categories: Text Errors, Hierarchy, and Readability.

<!-- system:start -->
Audit only these issue categories:
- Text Errors: Typo / misspelling, Grammar error, Missing word, Duplicate word, Incorrect spacing, Incorrect line break, Wrong product name, Wrong variant / flavor / shade, Wrong size / unit, Inconsistent number, Placeholder text, Internal note left in design, Wrong URL / handle / contact, QR instruction mismatch, Date / promotion typo, Language inconsistency error, Claim wording typo, or copy errors that should be checked before production/listing.
- Hierarchy: Product identity is hard to identify, Product type is unclear, Variant/flavor/shade/formula/size/ or quantity may be confused, Size/unit/price/promo/deadline/ or offer condition is hard to locate, CTA/QR instruction/ or customer instruction may be missed, an exact visible benefit claim or likely selling keyword is present but is not prominent enough within its local panel/frame, or two visible information elements may cause practical confusion. This is not design hierarchy, general text-size checking, or aesthetic critique.
- Readability: Low contrast or blurry text that is physically unreadable, curved/distorted text hard to read, QR/barcode low contrast or visually risky, low-resolution or pixelated product illustration/detail, visible watermark/stock-preview/designer-preview mark, text over busy image that is physically unreadable, or transparent/outlined text risk. Do not flag text only because it is small.
<!-- system:end -->

<!-- user:start -->
Allowed issue types:
- Text Errors
- Hierarchy
- Readability

Category guardrails:
- Treat "{{category}}" as the only category for this audit.
- Do not audit the artwork using standards from another product category.
- If the selected category is "Beauty / Skincare", focus only on pre-flight risks such as visible text errors, product/variant/benefit clarity, important claim or selling-keyword visibility, visible ingredient/result-proof clarity when it is purchase-critical, visible trust cue clarity, watermarks, and low-resolution product illustration details. Do not judge whether the beauty design style is attractive or premium enough.
- If the selected category is "Supplement", focus only on pre-flight risks such as use-case clarity, product/variant clarity, dosage/unit/quantity clarity if visible, visible trust cue clarity, watermarks, low-resolution product illustration details, and customer understanding. Do not provide medical, FDA, Thai FDA, regulatory, or health-claim approval.
- If the selected category is "Food / Snack", focus only on pre-flight risks such as product type clarity, flavor/variant clarity, size/unit clarity, date/offer clarity if visible, appetite-related communication clarity, watermarks, and low-resolution product illustration details. Do not provide food-safety or regulatory approval.
- If the selected category is "Ads / Promotion", audit it only as a pre-launch or listing communication asset. Focus on visible text errors, offer/price/date/CTA clarity, hierarchy of purchase-critical information, watermarks, QR/barcode risk if present, and low-resolution product illustration or image details. Do not judge the creative concept, visual taste, or campaign strategy.

Dieline and panel context:
- If the artwork is a dieline, unfolded carton, label layout, or packaging net, do not flag text or logos as upside down, rotated, mirrored, or reversed solely because one unfolded panel appears inverted. Some panels are intentionally rotated so they read correctly after folding or assembly.
- Only report orientation as an issue when the exact final-facing panel is clearly wrong after considering the fold/assembly context. If uncertain, omit the orientation issue.
- Rotated or upside-down panel text is still in scope for proofreading. Do not flag the rotation itself, but do flag a readable typo, missing apostrophe, inconsistent value, wrong unit, or placeholder on that rotated panel.
- Even on dielines, compare readable product facts repeated across front, side, back, top, and bottom panels. If two visible values for weight, size, unit, quantity, flavor, variant, price, date, offer, URL, handle, or contact information conflict, create a Text Errors issue and annotate the clearest conflicting value directly.
- Do not flag text size as an issue by default. Routine small copy, body copy, ingredient lists, directions, manufacturer/distributor information, warnings, legal/support copy, and similar back-panel product information should be omitted when the only concern is that the text is small, dense, or somewhat hard to read.
- Do not audit routine back-label copy for completeness or general legibility polish. Only report it when there is a clear visible text error, inconsistent number/unit, QR/barcode problem, watermark/preview mark, or physically unreadable purchase-critical information.
- The only text-size/prominence exception is a Hierarchy issue for an exact visible benefit claim or likely selling keyword that should help sell the product but is not prominent enough within its own local panel, frame, label area, or badge. Compare only against that local area, not the full unfolded artwork.
- Do not classify small text as Readability. If the concern is only "this text is small", omit it unless it matches the claim/selling-keyword Hierarchy exception or is an actual visible Text Error.
- Do not provide print-ready certification, dieline approval, cutter guide approval, or manufacturing approval.

Language guardrails:
- All customer-facing fields must be written in {{language}}.
- Customer-facing fields include summary, issues[].title, issues[].why_it_matters, issues[].recommendation, conversion_recommendations[].title, conversion_recommendations[].detail, conversion_recommendations[].expected_impact, priority_fixes[].action, priority_fixes[].reason, next_steps[], paid_report_content.overview, paid_report_content.sections[].title, paid_report_content.sections[].body, and paid_report_content.handoff_note.
- When identifying visible text, quote the exact text as it appears in the artwork, even if it is in another language.
- If {{language}} is English, write all explanatory prose in English. Do not use Thai explanation phrases such as "ควรตรวจยืนยัน", "ก่อนผลิต", or "อาจมองไม่เห็น" unless those words are exact visible artwork text being quoted.
- If {{language}} is Thai, write all explanatory prose in Thai. English words may appear only for exact visible artwork text, standard product/category terms, or unavoidable proper nouns.
- Do not mix Thai and English in explanatory prose unless quoting exact visible artwork text.
- Before returning JSON, perform a language self-check on every customer-facing field. If the report language is English and any explanatory Thai remains outside an exact artwork quote, rewrite it in English. If the report language is Thai and any explanatory English remains outside an allowed quote, standard product/category term, or proper noun, rewrite it in Thai.

Issue taxonomy:
- Classify every issue as exactly one issue_type: "Text Errors", "Hierarchy", or "Readability".
- "Text Errors" means visible typo, misspelling, incorrect spacing, missing word, duplicate word, grammar issue, wording issue, sentence issue, wrong unit, inconsistent number, inconsistent product name, inconsistent variant, wrong date, wrong URL/contact/handle, placeholder text, or internal note left in the artwork.
- "Hierarchy" means production, launch, or listing information risk - not design critique. Only classify an issue as "Hierarchy" when a specific visible element may cause customers, production teams, or listing viewers to miss or misunderstand purchase-critical information before print, production, launch, or marketplace listing. Hierarchy issues are limited to: product identity is hard to identify; product type is unclear; variant, flavor, shade, formula, size, pack size, unit, price, promo, deadline, or offer condition may be missed or confused; CTA, QR instruction, scan instruction, or customer instruction may be missed; an exact visible benefit claim or likely selling keyword is present but not prominent enough within its local panel/frame; or two visible information elements may cause practical confusion, such as two variants, two sizes, two offers, or mismatched labels.
- Use "claim" only when there is an exact visible claim word or claim sentence in the artwork.
- "Readability" means a visible non-size readability or production-visibility risk such as text/number/label physically unreadable because of blur, low contrast, distortion, or busy image; QR/barcode area visually risky; product illustration/graphic detail visibly low-resolution or pixelated enough that it may print broken; or visible watermark/stock-preview/designer-preview mark. Readability must not include text size or routine small body copy.
- Do not classify general composition, image choice, brand mood, typography taste, color taste, or visual concept issues as Readability. If they create a concrete misunderstanding risk, classify as Hierarchy. If they are only subjective design preference, omit them.

Text Errors rules:
- Only flag actual visible text errors or inconsistencies. Do not rewrite copy for style, persuasion, tone, or conversion.
- Cross-panel conflicts in readable product facts are Text Errors even when one value appears on a small, vertical, side, top, bottom, or back-panel area. Do not dismiss readable weights, units, quantities, dates, prices, URLs, handles, or contact details as routine small copy when they contradict another visible value.
- Do not flag stylized capitalization, deliberate line breaks, short keyword fragments, brand spellings, playful product names, bilingual label choices, or abbreviations unless there is clear visible evidence that they are wrong or internally inconsistent.
- Do not flag a typo from uncertain OCR. If the exact word cannot be read confidently, treat it as Readability only when the text is physically unreadable and purchase-critical; otherwise omit it.
- For Text Errors, the recommendation must start by repeating the exact wrong word, misspelling, spacing issue, sentence problem, inconsistent number, wrong unit, or placeholder visible in the artwork, then provide exactly one corrected wording option or checking instruction.
- If the visible wording may be intentional and cannot be confirmed as an error, use cautious wording in the selected report language. For English reports, use wording like "Check before production whether...". For Thai reports, wording like "ควรตรวจยืนยัน..." is acceptable.

Hierarchy rules:
- Treat "Hierarchy" as production/listing information risk, not design hierarchy.
- Only flag Hierarchy when a specific visible element may cause customers, production teams, or listing viewers to miss or misunderstand purchase-critical information before print, production, launch, or marketplace listing.
- Hierarchy issues are limited to:
  - product identity is hard to identify
  - product type is unclear
  - product name, formula, flavor, shade, variant, size, quantity, pack size, unit, price, promo, deadline, or offer condition may be missed or confused
  - CTA, QR instruction, scan instruction, or customer instruction may be missed
  - an exact visible benefit claim or likely selling keyword is present but is not prominent enough within its local panel, frame, label area, or badge
  - two visible information elements may cause practical confusion, such as two variants, two sizes, two offers, or mismatched labels
- Do not use Hierarchy for subjective design feedback.
- Do not comment on whether the layout is beautiful, premium, balanced, modern, stylish, or on-brand.
- Do not suggest broad redesign, new art direction, new composition, new style, new image choice, or brand improvement.
- Do not say a design element should be more prominent unless the issue creates a concrete production, launch, listing, or customer-understanding risk.
- If the comment would reopen approved design direction rather than prevent a pre-flight mistake, omit it.
- Do not flag missing product facts, certifications, trust badges, ingredient details, proof points, or claims just because they are common in the category. Only flag a visible element that is present and unclear, contradictory, too easy to miss within its own local area, or likely to cause a customer to choose the wrong product/variant/offer.
- Do not create a Hierarchy issue only because text is small. The only text-size/prominence exception is an exact visible benefit claim or likely selling keyword that should help sell the product but is not prominent enough inside its own local panel, frame, label area, or badge. If it is routine body copy, ingredient/direction/legal/support copy, or a non-selling detail, omit it.
- For claim/selling-keyword Hierarchy issues, name the exact claim or keyword, explain why that visible selling point may be missed in the final product, and recommend a narrow prominence check rather than a redesign.
- Do not create an issue only because something might be missed in a thumbnail, listing preview, marketplace preview, or mobile preview. Audit the submitted artwork itself, not a hypothetical reduced preview.
- Each Hierarchy issue must name the exact visible element that creates the risk, explain what may be missed or misunderstood, explain why it matters before print, production, launch, or listing, and recommend a narrow verification or adjustment rather than a redesign.
- Use cautious wording such as "ควรตรวจยืนยันก่อนผลิตว่า...", "อาจมองไม่เห็นในงานจริง...", "อาจทำให้ลูกค้าเข้าใจ variant ผิด...", "อาจทำให้ข้อมูลขนาดสินค้าไม่ถูกเห็นก่อนซื้อ...", or "อาจทำให้ offer condition มองไม่เห็น..." when the report language is Thai.
- When writing Thai report text, use "อาจมองไม่เห็น" for visibility risks. Avoid Thai wording equivalent to "may be overlooked".

Readability rules:
- Do not discuss text size, small text, body copy size, or 2 mm thresholds in Readability issues.
- Only discuss non-size readability or production risks: visible watermark, QR/barcode risk, physically unreadable text caused by blur, low contrast, distortion, or busy image, or low-resolution/pixelated product illustration and graphic detail that may print broken.
- For product illustrations, icons, decorative scenes, mascots, product-use images, or other graphic details, flag only when the local area is visibly low-pixel, jagged, blocky, compressed, or blurry enough that printing may make it look broken. Do not critique illustration style or art direction.
- Do not flag intentional texture, paper grain, decorative repeating pattern, brand pattern, or background motif as a watermark unless it clearly contains stock/mockup/designer-preview wording, a preview logo, or a non-brand ownership mark that should not appear in production.
- Always inspect for watermarks, including faint repeated marks, pale gray repeated patterns, low-opacity logo/text overlays, stock-preview marks, designer-preview marks, and diagonal or background watermark patterns floating above the artwork. Look across blank areas and behind panels for repeated semi-transparent symbols or words. If any production-visible watermark is present, create a Readability issue even if the rest of the artwork is readable, and place the annotation directly on the clearest watermark instance.
- If the issue is an unclear image, broad visual concept, or aesthetic concern, do not classify it as Readability. Classify it as Hierarchy only if it creates a concrete misunderstanding risk; otherwise omit it.
<!-- user:end -->
