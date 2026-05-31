# Eval CSV Templates

These CSV files are templates for Slaply's lightweight prompt eval data system.

They are metadata-only. Do not put real artwork, customer names, customer emails, public download links, private signed URLs, secrets, or raw artwork text that could identify a customer in these files.

Use pipe-separated values inside a single CSV cell when a field can contain multiple values:

```text
Text Errors|Hierarchy|Readability
broad_design_critique|premium_judgment|sales_guarantee
```

Active issue scope is limited to:

- `Text Errors`
- `Hierarchy`
- `Readability`

The 500+ project Full Case Bank is not the active eval set. It is a private source for sampling and edge-case mining. Keep the active Golden Set at 30-50 cases and the Regression Set at 100-150 cases.
