import {
  PROMPT_VERSION,
  SYSTEM_PROMPT_TEMPLATE,
  USER_PROMPT_TEMPLATE
} from "./generated/slaply-ai-prompts.generated";
import { formatProductCategory } from "./scan-form-options";

function optional(value) {
  return value || "Not provided";
}

function fillTemplate(template, values) {
  return Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

export { PROMPT_VERSION };

export function buildAiAuditPrompt(scan) {
  const category = formatProductCategory(scan.product_category);
  const language = scan.language === "english" ? "English" : "Thai";

  const replacements = {
    category,
    sales_channel: optional(scan.sales_channel),
    target_customer: optional(scan.target_customer),
    price_tier: optional(scan.price_tier),
    main_concern: optional(scan.main_concern),
    launch_stage: optional(scan.launch_stage),
    language
  };

  return {
    promptVersion: PROMPT_VERSION,
    systemPrompt: fillTemplate(SYSTEM_PROMPT_TEMPLATE, replacements),
    userPrompt: fillTemplate(USER_PROMPT_TEMPLATE, replacements)
  };
}
