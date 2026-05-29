# Slaply AI Prompts

The runtime prompt source has been modularized.

Source files:

- `slaply-ai/prompts/prompt.md`
- `slaply-ai/prompts/issue_library.md`
- `slaply-ai/prompts/rubric.md`
- `slaply-ai/prompts/examples.md`
- `slaply-ai/prompts/disclaimers.md`

Generated runtime module:

- `lib/generated/slaply-ai-prompts.generated.js`

Backend composition:

- `lib/ai-prompt-builder.js` fills runtime scan context such as product category, optional scan fields, and report language.
- `app/api/run-ai-scan/route.js` sends the composed system and user prompts to OpenAI.

Current prompt version:

- `slaply-preflight-v0.1`

Rules:

- Do not edit `lib/generated/slaply-ai-prompts.generated.js` directly.
- Edit the relevant markdown module under `slaply-ai/prompts/`.
- Run `npm run generate:ai-prompts` after prompt edits.
- Keep the current JSON schema, model, issue types, severity labels, language guardrails, and product scope unless a separate approved task says otherwise.
- Do not add broad design critique, subjective taste judgment, compliance approval, print-ready certification, manufacturing approval, or sales guarantee language.
- Do not add real customer artwork to the repo.

Prompt improvement loop:

- See `slaply-ai/evals/README.md`.
- Track prompt changes in `slaply-ai/evals/CHANGELOG.md`.
- Use `slaply-ai/evals/scorecards/scorecard-template.md` for human review.
- Use `scripts/compare-prompt-outputs.mjs` to compare saved JSON outputs across prompt versions.
