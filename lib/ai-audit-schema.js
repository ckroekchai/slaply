import { z } from "zod";

export const readinessLevels = ["Strong", "Good", "Risky", "Weak", "Critical"];
export const severities = ["High", "Medium", "Low", "Action"];

export const auditJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overall_score",
    "readiness_level",
    "summary",
    "scores",
    "issues",
    "conversion_recommendations",
    "priority_fixes",
    "next_steps",
    "paid_report_content"
  ],
  properties: {
    overall_score: { type: "integer", minimum: 0, maximum: 100 },
    readiness_level: { type: "string", enum: readinessLevels },
    summary: { type: "string" },
    scores: {
      type: "object",
      additionalProperties: false,
      required: [
        "message_clarity",
        "visual_hierarchy",
        "readability",
        "trust_signal",
        "premium_perception",
        "marketplace_readiness",
        "pre_production_visual_risk"
      ],
      properties: {
        message_clarity: { type: "integer", minimum: 0, maximum: 100 },
        visual_hierarchy: { type: "integer", minimum: 0, maximum: 100 },
        readability: { type: "integer", minimum: 0, maximum: 100 },
        trust_signal: { type: "integer", minimum: 0, maximum: 100 },
        premium_perception: { type: "integer", minimum: 0, maximum: 100 },
        marketplace_readiness: { type: "integer", minimum: 0, maximum: 100 },
        pre_production_visual_risk: { type: "integer", minimum: 0, maximum: 100 }
      }
    },
    issues: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "code", "title", "severity", "location", "why_it_matters", "recommendation"],
        properties: {
          id: { type: "integer", minimum: 1 },
          code: { type: "string" },
          title: { type: "string" },
          severity: { type: "string", enum: severities },
          location: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "confidence"],
            properties: {
              x: { type: "number", minimum: 0, maximum: 1 },
              y: { type: "number", minimum: 0, maximum: 1 },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            }
          },
          why_it_matters: { type: "string" },
          recommendation: { type: "string" }
        }
      }
    },
    next_steps: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string" }
    },
    conversion_recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "expected_impact"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          expected_impact: { type: "string" }
        }
      }
    },
    priority_fixes: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "action", "reason"],
        properties: {
          priority: { type: "string", enum: ["P1", "P2", "P3"] },
          action: { type: "string" },
          reason: { type: "string" }
        }
      }
    },
    paid_report_content: {
      type: "object",
      additionalProperties: false,
      required: ["overview", "sections", "handoff_note"],
      properties: {
        overview: { type: "string" },
        sections: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "body"],
            properties: {
              title: { type: "string" },
              body: { type: "string" }
            }
          }
        },
        handoff_note: { type: "string" }
      }
    }
  }
};

export const auditResultSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  readiness_level: z.enum(readinessLevels),
  summary: z.string().min(1),
  scores: z.object({
    message_clarity: z.number().int().min(0).max(100),
    visual_hierarchy: z.number().int().min(0).max(100),
    readability: z.number().int().min(0).max(100),
    trust_signal: z.number().int().min(0).max(100),
    premium_perception: z.number().int().min(0).max(100),
    marketplace_readiness: z.number().int().min(0).max(100),
    pre_production_visual_risk: z.number().int().min(0).max(100)
  }),
  issues: z.array(
    z.object({
      id: z.number().int().min(1),
      code: z.string().min(1),
      title: z.string().min(1),
      severity: z.enum(severities),
      location: z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        confidence: z.number().min(0).max(1)
      }),
      why_it_matters: z.string().min(1),
      recommendation: z.string().min(1)
    })
  ).min(1).max(8),
  conversion_recommendations: z.array(
    z.object({
      title: z.string().min(1),
      detail: z.string().min(1),
      expected_impact: z.string().min(1)
    })
  ).min(1).max(5),
  priority_fixes: z.array(
    z.object({
      priority: z.enum(["P1", "P2", "P3"]),
      action: z.string().min(1),
      reason: z.string().min(1)
    })
  ).min(1).max(5),
  next_steps: z.array(z.string().min(1)).min(1).max(5),
  paid_report_content: z.object({
    overview: z.string().min(1),
    sections: z.array(
      z.object({
        title: z.string().min(1),
        body: z.string().min(1)
      })
    ).min(1).max(5),
    handoff_note: z.string().min(1)
  })
});
