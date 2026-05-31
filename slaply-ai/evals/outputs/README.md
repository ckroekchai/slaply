# Eval Outputs

Save sanitized JSON outputs by prompt version:

```text
outputs/
  slaply-preflight-v0.1/
    SKINCARE_001.json
  slaply-preflight-v0.2/
    SKINCARE_001.json
```

Do not commit raw customer images, private URLs, emails, names, or secrets.

Outputs should be generated only from private/local artwork access and should be reviewed before committing. Redact any customer-identifying text that is not required for prompt evaluation.

Use `scripts/compare-prompt-outputs.mjs` to compare two saved JSON outputs:

```sh
node scripts/compare-prompt-outputs.mjs \
  slaply-ai/evals/outputs/slaply-preflight-v0.1/SKINCARE_001.json \
  slaply-ai/evals/outputs/slaply-preflight-v0.2/SKINCARE_001.json
```
