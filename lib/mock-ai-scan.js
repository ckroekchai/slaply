export const mockAiModel = "mock-ai-scan-v1";

export function isMockAiScanEnabled() {
  return process.env.MOCK_AI_SCAN === "true" || !process.env.OPENAI_API_KEY;
}

function isThai(scan) {
  return scan.language !== "english";
}

export function buildMockAuditResult(scan) {
  if (!isThai(scan)) {
    return {
      overall_score: 72,
      readiness_level: "Good",
      summary:
        "The artwork is commercially usable, but the key selling message needs stronger hierarchy before production. The main risks are weak benefit priority, unclear proof placement, and a supporting illustration detail that may not stay crisp in print.",
      scores: {
        message_clarity: 68,
        visual_hierarchy: 70,
        readability: 74,
        trust_signal: 66,
        premium_perception: 78,
        marketplace_readiness: 72,
        pre_production_visual_risk: 61
      },
      issue_counts: {
        text_errors: 0,
        hierarchy: 3,
        readability: 1
      },
      issues: [
        {
          id: 1,
          issue_type: "Hierarchy",
          code: "BENEFIT_HIERARCHY",
          title: "Main benefit is not dominant enough",
          severity: "High",
          location: { x: 0.52, y: 0.36, confidence: 0.86 },
          why_it_matters:
            "A shopper should understand the strongest reason to care within the first few seconds. The current hierarchy makes the product feel attractive but less decisive.",
          recommendation:
            "Increase the primary benefit size by 15-25%, move it closer to the visual center, and reduce competing secondary copy around it."
        },
        {
          id: 2,
          issue_type: "Hierarchy",
          code: "TRUST_CUE",
          title: "Trust cues need clearer placement",
          severity: "Medium",
          location: { x: 0.42, y: 0.72, confidence: 0.72 },
          why_it_matters:
            "Premium packaging still needs enough proof to reduce purchase hesitation, especially for new brands or new listings.",
          recommendation:
            "Add one concise proof point near the product name, such as ingredient cue, usage result, material quality, or origin cue."
        },
        {
          id: 3,
          issue_type: "Hierarchy",
          code: "ACTION_ORDER",
          title: "Information order can be simplified",
          severity: "Low",
          location: { x: 0.34, y: 0.48, confidence: 0.69 },
          why_it_matters:
            "A clearer sequence helps the customer scan from product type to benefit to proof without working too hard.",
          recommendation:
            "Use a three-level order: product type first, main benefit second, supporting proof third."
        },
        {
          id: 4,
          issue_type: "Readability",
          code: "LOW_RES_ILLUSTRATION_DETAIL",
          title: "Supporting illustration detail may look pixelated in print",
          severity: "Medium",
          location: { x: 0.72, y: 0.55, confidence: 0.78 },
          why_it_matters:
            "A low-pixel illustration or decorative product detail can make an otherwise polished package feel less production-ready after print.",
          recommendation:
            "Replace the detail with a higher-resolution source file or simplify the illustration so edges stay clean at final print size."
        }
      ],
      conversion_recommendations: [
        {
          title: "Make the promise visible first",
          detail: "Lead with one concrete outcome rather than several small claims competing for attention.",
          expected_impact: "Improves first-glance understanding and gives the artwork a clearer selling anchor."
        },
        {
          title: "Reduce decision friction",
          detail: "Move the most useful proof point close to the product name so the buyer does not need to search.",
          expected_impact: "Creates more confidence for new customers who do not already know the brand."
        },
        {
          title: "Clean up low-resolution supporting art",
          detail: "Replace or simplify any decorative illustration detail that may print with fuzzy edges.",
          expected_impact: "Keeps the finished pack looking intentional and production-ready."
        }
      ],
      priority_fixes: [
        {
          priority: "P1",
          action: "Rewrite and enlarge the primary benefit line.",
          reason: "This is the highest leverage fix because it affects clarity before all other details are noticed."
        },
        {
          priority: "P2",
          action: "Replace low-resolution supporting illustration detail.",
          reason: "Crisper source artwork reduces the chance that the final printed pack looks unfinished."
        },
        {
          priority: "P3",
          action: "Add one compact trust cue.",
          reason: "A small proof point can make the design feel more purchase-ready without crowding the layout."
        }
      ],
      next_steps: [
        "Create one revised version with a larger primary benefit.",
        "Check supporting illustrations at final print size and replace any low-resolution source art.",
        "Send the revised artwork to a designer with the priority fixes above."
      ],
      paid_report_content: {
        overview:
          "Paid report sample: the artwork has a strong visual mood and premium direction, but needs tighter message hierarchy before final production approval.",
        sections: [
          {
            title: "Commercial clarity",
            body:
              "The package should communicate product type, main benefit, and proof in that order. At the moment, the design leans more toward mood than decision support."
          },
          {
            title: "Pre-production risk",
            body:
              "The most important risk is not regulatory or legal approval. The risk is that buyers may not understand the product advantage quickly enough in real buying contexts."
          },
          {
            title: "Designer handoff",
            body:
              "Ask the designer to produce one hierarchy revision, one proof-placement revision, and one final-resolution artwork check before preparing final files."
          }
        ],
        handoff_note:
          "This mock paid report content is structured like the production report and can be replaced by live AI output when MOCK_AI_SCAN=false."
      }
    };
  }

  return {
    overall_score: 72,
    readiness_level: "Good",
    summary:
      "งานอาร์ตเวิร์กนี้ดูพร้อมใช้งานในเชิงภาพรวม แต่ข้อความขายหลักยังควรถูกดันให้ชัดขึ้นก่อนผลิตจริง ความเสี่ยงหลักคือ hierarchy ของ benefit ยังไม่เด่นพอ proof placement ยังไม่ชัด และรายละเอียด illustration บางจุดอาจไม่คมพอเมื่อพิมพ์จริง",
    scores: {
      message_clarity: 68,
      visual_hierarchy: 70,
      readability: 74,
      trust_signal: 66,
      premium_perception: 78,
      marketplace_readiness: 72,
      pre_production_visual_risk: 61
    },
    issue_counts: {
      text_errors: 0,
      hierarchy: 3,
      readability: 1
    },
    issues: [
      {
        id: 1,
        issue_type: "Hierarchy",
        code: "BENEFIT_HIERARCHY",
        title: "Benefit หลักยังไม่เด่นพอ",
        severity: "High",
        location: { x: 0.52, y: 0.36, confidence: 0.86 },
        why_it_matters:
          "ลูกค้าควรเข้าใจเหตุผลหลักที่ต้องสนใจสินค้าภายในไม่กี่วินาที ตอนนี้ภาพรวมดูดี แต่จุดขายหลักยังไม่พุ่งพอสำหรับการตัดสินใจเร็ว",
        recommendation:
          "ขยายข้อความ benefit หลักขึ้นประมาณ 15-25%, ย้ายเข้าใกล้จุดโฟกัส และลดข้อความรองที่แย่งสายตาในบริเวณเดียวกัน"
      },
      {
        id: 2,
        issue_type: "Hierarchy",
        code: "TRUST_CUE",
        title: "Trust cue ยังควรวางให้ชัดขึ้น",
        severity: "Medium",
        location: { x: 0.42, y: 0.72, confidence: 0.72 },
        why_it_matters:
          "แพ็กเกจที่ดูพรีเมียมยังต้องมีหลักฐานเล็ก ๆ เพื่อช่วยลดความลังเล โดยเฉพาะแบรนด์ใหม่หรือสินค้าที่ลูกค้ายังไม่รู้จัก",
        recommendation:
          "เพิ่ม proof point สั้น ๆ ใกล้ชื่อสินค้า เช่น จุดเด่นส่วนผสม ผลลัพธ์การใช้งาน วัสดุ หรือแหล่งที่มา"
      },
      {
        id: 3,
        issue_type: "Hierarchy",
        code: "ACTION_ORDER",
        title: "ลำดับข้อมูลยังทำให้สแกนยาก",
        severity: "Low",
        location: { x: 0.34, y: 0.48, confidence: 0.69 },
        why_it_matters:
          "ลำดับข้อมูลที่ชัดช่วยให้ลูกค้าไล่จากประเภทสินค้า ไป benefit และ proof ได้โดยไม่ต้องใช้แรงอ่านเยอะ",
        recommendation:
          "จัด hierarchy เป็น 3 ชั้น: ประเภทสินค้า > benefit หลัก > proof สนับสนุน"
      },
      {
        id: 4,
        issue_type: "Readability",
        code: "LOW_RES_ILLUSTRATION_DETAIL",
        title: "รายละเอียด illustration อาจแตกเมื่อพิมพ์จริง",
        severity: "Medium",
        location: { x: 0.72, y: 0.55, confidence: 0.78 },
        why_it_matters:
          "illustration หรือรายละเอียดตกแต่งที่ pixel ไม่พอ อาจทำให้แพ็กเกจที่ดูดีโดยรวมรู้สึกไม่เนี้ยบหลังพิมพ์จริง",
        recommendation:
          "เปลี่ยนเป็นไฟล์ต้นฉบับความละเอียดสูงขึ้น หรือ simplify รายละเอียด illustration เพื่อให้ขอบภาพยังคมที่ขนาดพิมพ์จริง"
      }
    ],
    conversion_recommendations: [
      {
        title: "ทำให้คำสัญญาหลักเห็นก่อน",
        detail: "เลือก outcome เดียวที่ชัดที่สุด แทนการให้หลาย claim เล็ก ๆ แย่งความสนใจพร้อมกัน",
        expected_impact: "ช่วยให้ลูกค้าเข้าใจเร็วขึ้น และทำให้อาร์ตเวิร์กมีจุดขายที่จับได้ทันที"
      },
      {
        title: "ลดแรงเสียดทานก่อนตัดสินใจ",
        detail: "วาง proof point ที่มีประโยชน์ที่สุดไว้ใกล้ชื่อสินค้า เพื่อให้ลูกค้าไม่ต้องค้นหาหลักฐานเอง",
        expected_impact: "เพิ่มความมั่นใจให้ลูกค้าใหม่ที่ยังไม่รู้จักแบรนด์"
      },
      {
        title: "แก้ artwork detail ที่ความละเอียดต่ำ",
        detail: "เปลี่ยนหรือ simplify รายละเอียด illustration ที่อาจพิมพ์ออกมาแล้วขอบแตกหรือฟุ้ง",
        expected_impact: "ช่วยให้แพ็กเกจจริงดูเนี้ยบและพร้อมผลิตมากขึ้น"
      }
    ],
    priority_fixes: [
      {
        priority: "P1",
        action: "เขียนและขยาย benefit หลักใหม่",
        reason: "เป็นจุดที่มีผลต่อความเข้าใจเร็วที่สุด ก่อนที่ลูกค้าจะเห็นรายละเอียดอื่น"
      },
      {
        priority: "P2",
        action: "เปลี่ยนรายละเอียด illustration ที่ความละเอียดต่ำ",
        reason: "ลดโอกาสที่งานพิมพ์จริงจะดูไม่คม หรือเหมือนไฟล์ต้นฉบับไม่พร้อมผลิต"
      },
      {
        priority: "P3",
        action: "เพิ่ม trust cue แบบสั้นหนึ่งจุด",
        reason: "ช่วยให้ดีไซน์ดูพร้อมขายขึ้น โดยไม่ทำให้ layout แน่นเกินไป"
      }
    ],
    next_steps: [
      "ทำ revision หนึ่งเวอร์ชันโดยขยาย benefit หลักให้เด่นขึ้น",
      "ตรวจ illustration ที่ขนาดพิมพ์จริง และแทนที่ไฟล์ต้นฉบับที่ความละเอียดต่ำ",
      "ส่ง priority fixes ให้ designer ใช้เป็น brief สำหรับแก้ไฟล์จริง"
    ],
    paid_report_content: {
      overview:
        "ตัวอย่าง paid report: อาร์ตเวิร์กมี mood และภาพรวมที่ดูพรีเมียม แต่ควรจัด hierarchy ของข้อความขายให้ชัดขึ้นก่อนอนุมัติผลิตจริง",
      sections: [
        {
          title: "Commercial clarity",
          body:
            "แพ็กเกจควรสื่อสารประเภทสินค้า benefit หลัก และหลักฐานสนับสนุนตามลำดับ ตอนนี้งานยังเล่า mood ได้ดีมากกว่าช่วยลูกค้าตัดสินใจทันที"
        },
        {
          title: "Pre-production risk",
          body:
            "ความเสี่ยงหลักไม่ใช่การอนุมัติกฎหมายหรือ compliance แต่คือความเสี่ยงที่ลูกค้าไม่เข้าใจจุดเด่นของสินค้าเร็วพอในบริบทการซื้อจริง"
        },
        {
          title: "Designer handoff",
          body:
            "ให้ designer ทำ 3 อย่างก่อน export ไฟล์ final: hierarchy revision, proof-placement revision และ final-resolution artwork check"
        }
      ],
      handoff_note:
        "เนื้อหานี้เป็น mock paid report ที่ใช้โครงเดียวกับ production report และจะถูกแทนด้วยผล AI จริงเมื่อ MOCK_AI_SCAN=false"
    }
  };
}
