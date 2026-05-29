# Slaply AI Prompt System

This folder is the source of truth for the Slaply AI Audit prompt improvement loop.

## Prompt Modules

- `prompts/prompt.md` - core role, audit objective, customer context, language guardrails, output rules, and tone.
- `prompts/issue_library.md` - Text Errors, Hierarchy, and Readability definitions plus detect/omit rules.
- `prompts/rubric.md` - issue counts, sorting, annotation placement, severity, scoring, and recommendation tone.
- `prompts/examples.md` - active out-of-scope examples plus synthetic reference examples for human review.
- `prompts/disclaimers.md` - compliance, legal, FDA/Thai FDA, print-ready, manufacturing, and sales guarantee boundaries.

Runtime prompt code is generated from these files into `lib/generated/slaply-ai-prompts.generated.js`.

## Edit Rule

Change the smallest module that matches the failure pattern. Avoid editing every prompt file in one pass.

## Hard Boundaries

- Do not add broad design critique.
- Do not add subjective taste, premium, beauty, brand mood, or art direction judgment.
- Do not add compliance, FDA, Thai FDA, legal, food-safety, print-ready, manufacturing, or sales approval.
- Do not add real customer artwork or confidential client content to this repository.
