import { now } from './core.mjs';

// Only these curated messages may cross the Workflow serialization boundary.
// Never reuse a provider Error.message: it can contain request details or secrets.
const PUBLIC_JOB_ERRORS = Object.freeze({
  AI_CONFIGURATION: 'ระบบ AI ยังไม่พร้อมให้บริการ กรุณาติดต่อ Slaply',
  AI_BUSY: 'ระบบ AI ถึงขีดจำกัดชั่วคราว กรุณาลองภายหลัง',
  AI_REFUSAL: 'AI ไม่สามารถสร้างจากวัตถุดิบนี้ได้ กรุณาเปลี่ยนรูปหรือคำบรรยาย',
  AI_PROVIDER_ERROR: 'สร้างผลลัพธ์ไม่สำเร็จ กรุณาลองอีกครั้ง',
  AI_TIMEOUT: 'AI ใช้เวลานานเกินไป งานรอบนี้ไม่สำเร็จ กรุณาลองภายหลัง',
  AI_INVALID_OUTPUT: 'AI ส่งผลลัพธ์ไม่ครบ กรุณาลองปรุงใหม่',
  AI_INVALID_IMAGE: 'AI ไม่ได้ส่งภาพที่ใช้งานได้ กรุณาลองใหม่',
  INPUT_MISSING: 'ไม่พบรูปต้นฉบับ กรุณาอัปโหลดอีกครั้ง',
  AI_JOB_FAILED: 'งาน AI ไม่สำเร็จ กรุณาลองปรุงใหม่',
});

export function publicJobFailure(error, persisted = {}) {
  const known = code => Object.hasOwn(PUBLIC_JOB_ERRORS, code || '');
  const code = known(persisted.error_code) ? persisted.error_code : known(error?.code) ? error.code : 'AI_JOB_FAILED';
  return { code, message: PUBLIC_JOB_ERRORS[code] };
}

export async function captureStageFailure(env, jobId, operation) {
  try { return await operation(); }
  catch (error) {
    const failure = publicJobFailure(error);
    // Persist before throwing: Cloudflare serializes step exceptions and can discard
    // custom properties/prototypes. The outer handler reads this durable public code.
    await env.SLAPLY_DB.prepare("UPDATE brand_jobs SET error_code = ?,error_message = ?,updated_at = ? WHERE id = ? AND status IN ('queued','analyzing','generating')").bind(failure.code,failure.message,now(),jobId).run();
    throw new Error('Brand generation stage failed');
  }
}
