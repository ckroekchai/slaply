import { readFileSync } from "node:fs";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function unwrapResult(output) {
  return output.result || output.scan?.preview || output.preview || output;
}

function issueSummary(result) {
  return (result.issues || []).map((issue) => ({
    id: issue.id,
    issue_type: issue.issue_type,
    severity: issue.severity,
    title: issue.title,
    location: issue.location
  }));
}

function printComparison(label, before, after) {
  console.log(`\n${label}`);
  console.log(`- before: ${before ?? "n/a"}`);
  console.log(`- after:  ${after ?? "n/a"}`);
}

const [beforePath, afterPath] = process.argv.slice(2);

if (!beforePath || !afterPath) {
  console.error("Usage: node scripts/compare-prompt-outputs.mjs <before.json> <after.json>");
  process.exit(1);
}

const before = unwrapResult(readJson(beforePath));
const after = unwrapResult(readJson(afterPath));

console.log("Prompt output comparison");
console.log(`Before: ${beforePath}`);
console.log(`After:  ${afterPath}`);

printComparison("Overall score", before.overall_score, after.overall_score);
printComparison("Readiness", before.readiness_level, after.readiness_level);
printComparison("Summary", before.summary, after.summary);

console.log("\nIssue counts");
console.log("before:", JSON.stringify(before.issue_counts || {}, null, 2));
console.log("after: ", JSON.stringify(after.issue_counts || {}, null, 2));

console.log("\nIssues");
console.log("before:", JSON.stringify(issueSummary(before), null, 2));
console.log("after: ", JSON.stringify(issueSummary(after), null, 2));
