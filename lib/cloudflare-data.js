import { randomUUID } from "node:crypto";
import { getIssueCounts, inferIssueType, sortIssuesForReport } from "./audit-issue-utils";
import { getCloudflareBindings } from "./cloudflare-context";

function nowIso() {
  return new Date().toISOString();
}

function encodeJson(value) {
  return value == null ? null : JSON.stringify(value);
}

function decodeJson(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeScan(row) {
  if (!row) return null;

  return {
    ...row,
    ai_raw_output: decodeJson(row.ai_raw_output),
    ai_validated_output: decodeJson(row.ai_validated_output)
  };
}

function normalizePayment(row) {
  if (!row) return null;

  return {
    ...row,
    raw_event: decodeJson(row.raw_event)
  };
}

export function isCloudflareDataEnabled() {
  return process.env.DATA_BACKEND === "cloudflare";
}

export async function getCloudflareDataStore() {
  const { d1, uploads } = await getCloudflareBindings();

  if (!d1 || !uploads) {
    throw new Error("Cloudflare D1/R2 bindings are not configured.");
  }

  return createCloudflareDataStore(d1, uploads);
}

export function createCloudflareDataStore(d1, uploads) {
  return {
    async createScan({ scanId, image, context, storagePath }) {
      const fileBuffer = await image.arrayBuffer();

      await uploads.put(storagePath, fileBuffer, {
        httpMetadata: { contentType: image.type },
        customMetadata: {
          scan_id: scanId,
          original_name: image.name || "artwork"
        }
      });

      const customerId = randomUUID();
      const createdAt = nowIso();

      await d1
        .prepare("insert into customers (id, created_at, email, country) values (?, ?, ?, ?)")
        .bind(customerId, createdAt, context.email, "TH")
        .run();

      await d1
        .prepare(
          `insert into scans (
            id, created_at, customer_id, customer_email, image_url, image_storage_path,
            product_category, sales_channel, target_customer, price_tier, main_concern,
            launch_stage, language, scan_status, payment_status
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          scanId,
          createdAt,
          customerId,
          context.email,
          `/api/get-upload?key=${encodeURIComponent(storagePath)}`,
          storagePath,
          context.product_category,
          null,
          null,
          null,
          null,
          null,
          context.language,
          "uploaded",
          "unpaid"
        )
        .run();

      await this.insertEvents([
        {
          scan_id: scanId,
          customer_email: context.email,
          event_name: "image_uploaded",
          event_data: { file_type: image.type, file_size: image.size }
        },
        {
          scan_id: scanId,
          customer_email: context.email,
          event_name: "form_completed",
          event_data: {
            product_category: context.product_category,
            language: context.language
          }
        }
      ]);

      return { scanId, storagePath };
    },

    async getScan(scanId) {
      const row = await d1.prepare("select * from scans where id = ?").bind(scanId).first();
      return normalizeScan(row);
    },

    async getScanImageResponse(storagePath) {
      const object = await uploads.get(storagePath);

      if (!object) {
        return null;
      }

      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "private, max-age=300"
        }
      });
    },

    async getScanImageDataUrl(scan) {
      if (!scan.image_storage_path) {
        throw new Error("Scan is missing image_storage_path.");
      }

      const object = await uploads.get(scan.image_storage_path);

      if (!object) {
        throw new Error("Could not download artwork image.");
      }

      const arrayBuffer = await object.arrayBuffer();
      const mimeType = object.httpMetadata?.contentType || (scan.image_storage_path.endsWith(".png") ? "image/png" : "image/jpeg");
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return `data:${mimeType};base64,${base64}`;
    },

    async markScanScanning(scanId) {
      await d1
        .prepare("update scans set scan_status = ?, error_message = ? where id = ?")
        .bind("processing", null, scanId)
        .run();
    },

    async markScanPreviewReady(scanId, { model, rawOutput, validated }) {
      await d1
        .prepare(
          `update scans set
            scan_status = ?, ai_model = ?, ai_raw_output = ?, ai_validated_output = ?,
            overall_score = ?, readiness_level = ?, error_message = ?
          where id = ?`
        )
        .bind(
          "completed",
          model,
          encodeJson(rawOutput),
          encodeJson(validated),
          validated.overall_score,
          validated.readiness_level,
          null,
          scanId
        )
        .run();
    },

    async insertScanCost({
      scanId,
      model,
      inputTokens = null,
      outputTokens = null,
      estimatedAiCostUsd = null,
      retryCount = 0,
      processingTimeMs = null,
      errorReason = null
    }) {
      await d1
        .prepare(
          `insert into scan_costs (
            id, created_at, scan_id, model, input_tokens, output_tokens,
            estimated_ai_cost_usd, retry_count, processing_time_ms, error_reason
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          randomUUID(),
          nowIso(),
          scanId,
          model,
          inputTokens,
          outputTokens,
          estimatedAiCostUsd,
          retryCount,
          processingTimeMs,
          errorReason
        )
        .run();
    },

    async markScanFailed(scanId, message) {
      await d1
        .prepare("update scans set scan_status = ?, error_message = ? where id = ?")
        .bind("failed", message, scanId)
        .run();
    },

    async getPaymentById(paymentId, scanId) {
      if (!paymentId && !scanId) return null;

      const row = paymentId
        ? await d1.prepare("select * from payments where id = ? limit 1").bind(paymentId).first()
        : await d1
            .prepare("select * from payments where scan_id = ? order by created_at desc limit 1")
            .bind(scanId)
            .first();

      return normalizePayment(row);
    },

    async getPendingPayment(scanId) {
      const row = await d1
        .prepare(
          `select * from payments
           where scan_id = ? and provider = ? and payment_status in ('created', 'pending')
           order by created_at desc limit 1`
        )
        .bind(scanId, "promptpay_qr")
        .first();
      return normalizePayment(row);
    },

    async createPayment({ scan, amount }) {
      const id = randomUUID();
      const now = nowIso();
      const rawEvent = { method: "manual_promptpay_qr" };

      await d1
        .prepare(
          `insert into payments (
            id, created_at, scan_id, customer_email, provider, provider_payment_id,
            amount, currency, payment_status, raw_event
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          now,
          scan.id,
          scan.customer_email,
          "promptpay_qr",
          `manual-${randomUUID()}`,
          amount,
          "THB",
          "pending",
          encodeJson(rawEvent)
        )
        .run();

      const payment = await this.getPaymentById(id);

      await this.insertEvent({
        scan_id: scan.id,
        customer_email: scan.customer_email,
        event_name: "payment_request_created",
        event_data: {
          payment_id: id,
          provider: "promptpay_qr",
          amount,
          currency: "THB"
        }
      });

      return payment;
    },

    async unlockScan({ scan, paymentId, reportUrl, note }) {
      await d1
        .prepare("update scans set payment_status = ?, report_url = ? where id = ?")
        .bind("paid", reportUrl, scan.id)
        .run();

      if (paymentId) {
        await d1
          .prepare("update payments set payment_status = ?, paid_at = ?, raw_event = ? where id = ?")
          .bind("paid", nowIso(), encodeJson({ method: "manual_admin_unlock", note }), paymentId)
          .run();
      } else {
        await d1
          .prepare("update payments set payment_status = ?, paid_at = ?, raw_event = ? where scan_id = ?")
          .bind("paid", nowIso(), encodeJson({ method: "manual_admin_unlock", note }), scan.id)
          .run();
      }

      await this.insertEvent({
        scan_id: scan.id,
        customer_email: scan.customer_email,
        event_name: "report_unlocked_manually",
        event_data: {
          payment_id: paymentId || null,
          note
        }
      });
    },

    async insertEvent(event) {
      await this.insertEvents([event]);
    },

    async insertEvents(events) {
      if (!events.length) return;

      const statements = events.map((event) =>
        d1
          .prepare(
            `insert into events (id, created_at, scan_id, customer_email, event_name, event_data)
             values (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            randomUUID(),
            nowIso(),
            event.scan_id,
            event.customer_email,
            event.event_name,
            encodeJson(event.event_data || {})
          )
      );

      await d1.batch(statements);
    },

    getSafeScan(scan) {
      if (!scan) return null;

      const output = scan.ai_validated_output || null;
      const isMock = scan.ai_model === "mock-ai-scan-v1" || scan.ai_raw_output?.mock === true;
      const sortedIssues = output ? sortIssuesForReport(output.issues || []) : [];

      return {
        id: scan.id,
        created_at: scan.created_at,
        customer_email: scan.customer_email,
        product_category: scan.product_category,
        sales_channel: scan.sales_channel,
        target_customer: scan.target_customer,
        price_tier: scan.price_tier,
        main_concern: scan.main_concern,
        launch_stage: scan.launch_stage,
        language: scan.language,
        scan_status: scan.scan_status,
        payment_status: scan.payment_status,
        is_mock: isMock,
        overall_score: scan.overall_score,
        readiness_level: scan.readiness_level,
        preview: output
          ? {
              overall_score: output.overall_score,
              readiness_level: output.readiness_level,
              summary: output.summary,
              issue_counts: getIssueCounts(output),
              issues: sortedIssues.map((issue, index) => ({
                id: issue.id,
                display_id: index + 1,
                issue_type: inferIssueType(issue),
                code: issue.code,
                title: issue.title,
                severity: issue.severity,
                why_it_matters: issue.why_it_matters,
                recommendation: issue.recommendation,
                location: issue.location
              })),
              recommendations_locked: false
            }
          : null,
        full_report: output
      };
    },

    getSafePayment(payment) {
      if (!payment) return null;

      return {
        id: payment.id,
        created_at: payment.created_at,
        scan_id: payment.scan_id,
        amount: payment.amount,
        currency: payment.currency,
        payment_status: payment.payment_status,
        paid_at: payment.paid_at,
        provider: payment.provider
      };
    }
  };
}
