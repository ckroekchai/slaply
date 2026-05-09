export const issueTypeOrder = ["Text Errors", "Hierarchy", "Readability"];

export function inferIssueType(issue = {}) {
  if (issueTypeOrder.includes(issue.issue_type)) {
    return issue.issue_type;
  }

  const text = [issue.code, issue.title, issue.why_it_matters, issue.recommendation]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /text|typo|spell|grammar|word|copy|sentence|spacing|space|misspell|สะกด|คำผิด|วรรค|ประโยค|ข้อความ/.test(text)
  ) {
    return "Text Errors";
  }

  if (
    /readability|readable|legible|font|contrast|small|thumbnail|blur|watermark|stock|preview|designer|อ่านยาก|อ่านไม่ออก|ตัวอักษร|ฟอนต์|ตัวเล็ก|คอนทราสต์|ลายน้ำ/.test(text)
  ) {
    return "Readability";
  }

  return "Hierarchy";
}

export function sortIssuesForReport(issues = []) {
  return [...issues].sort((a, b) => {
    const typeDelta = issueTypeOrder.indexOf(inferIssueType(a)) - issueTypeOrder.indexOf(inferIssueType(b));

    if (typeDelta !== 0) return typeDelta;
    return (a.id || 0) - (b.id || 0);
  });
}

export function getIssueCounts(result = {}) {
  const explicit = result.issue_counts;

  if (explicit) {
    return {
      text_errors: Number.isInteger(explicit.text_errors) ? explicit.text_errors : 0,
      hierarchy: Number.isInteger(explicit.hierarchy) ? explicit.hierarchy : 0,
      readability: Number.isInteger(explicit.readability) ? explicit.readability : 0
    };
  }

  return (result.issues || []).reduce(
    (counts, issue) => {
      const type = inferIssueType(issue);

      if (type === "Text Errors") counts.text_errors += 1;
      if (type === "Hierarchy") counts.hierarchy += 1;
      if (type === "Readability") counts.readability += 1;

      return counts;
    },
    { text_errors: 0, hierarchy: 0, readability: 0 }
  );
}
