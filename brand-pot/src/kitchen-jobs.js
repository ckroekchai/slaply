import { apiRequest } from './api.js';

// UI revisions own the visible result. Aborting a request does not imply that a
// provider has stopped work; the server owns cancellation and usage accounting.
export function createKitchenJobs({ onState, onComplete, onError = () => {}, onJob = () => {}, prepareMs = 1200, pollMs = 1800, request = apiRequest, clock = globalThis, makeKey = () => crypto.randomUUID() }) {
  let revision = 0, preparation, pollTimer, controller, currentJob;
  const clear = () => { clock.clearTimeout(preparation); clock.clearTimeout(pollTimer); controller?.abort(); };
  const cancelRemote = id => { if (id) request(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}' }).catch(() => {}); };
  const inspect = async (id, ownRevision, signal, retries = 0) => {
    let data;
    try { data = await request(`/api/jobs/${encodeURIComponent(id)}`, { signal }); }
    catch (error) {
      if (ownRevision !== revision || error.name === 'AbortError') return;
      if ((!error.status || error.status >= 500 || error.status === 429) && retries < 3) {
        onState({ phase: 'cooking', step: 'reconnecting', revision: ownRevision });
        pollTimer = clock.setTimeout(() => inspect(id, ownRevision, signal, retries + 1).catch(error => fail(error, ownRevision)), pollMs * (retries + 2));
        return;
      }
      throw error;
    }
    if (ownRevision !== revision) return;
    if (['completed', 'complete', 'succeeded', 'ready'].includes(data.status)) {
      if (!data.recipe) throw new Error('AI ยังไม่ส่งสูตรที่สมบูรณ์ กรุณาลองใหม่');
      currentJob = null; onJob(null); onComplete(data.recipe, ownRevision);
      onState({ phase: 'ready', revision: ownRevision }); return;
    }
    if (['failed', 'error', 'cancelled', 'canceled'].includes(data.status)) {
      currentJob = null; onJob(null);
      throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || (data.status.startsWith('cancel') ? 'งานนี้ถูกยกเลิกแล้ว' : 'AI สร้างงานไม่สำเร็จ กรุณาลองใหม่'));
    }
    onState({ phase: 'cooking', step: data.phase || data.status, revision: ownRevision });
    pollTimer = clock.setTimeout(() => inspect(id, ownRevision, signal).catch(error => fail(error, ownRevision)), pollMs);
  };
  const fail = (error, ownRevision) => {
    if (ownRevision !== revision || error.name === 'AbortError') return;
    // A transient polling failure must not lose an already accepted server job.
    onState({ phase: 'error', revision: ownRevision, error: error.message, jobId: currentJob || null }); onError(error);
  };
  return {
    start(payload) {
      clear(); cancelRemote(currentJob); currentJob = null;
      const id = ++revision, idempotencyKey = makeKey(); controller = new AbortController(); const signal = controller.signal;
      onState({ phase: 'pouring', revision: id });
      preparation = clock.setTimeout(async () => {
        if (id !== revision) return;
        onState({ phase: 'cooking', step: 'queued', revision: id });
        try {
          const job = await request('/api/jobs', { method: 'POST', body: JSON.stringify({ idempotencyKey, ingredients: payload.ingredients.filter(Boolean).map(item => ({ id: item.id, locked: Boolean(item.locked), ...(['logo','product','reference'].includes(item.role) ? { role: item.role } : {}) })), brief: payload.brief }) });
          if (id !== revision) { cancelRemote(job.id); return; }
          if (!job.id) throw new Error('สร้างงานไม่สำเร็จ กรุณาลองใหม่');
          currentJob = job.id; onJob(job.id); await inspect(job.id, id, signal);
        } catch (error) { fail(error, id); }
      }, prepareMs);
      return id;
    },
    resume(jobId) {
      clear(); const id = ++revision; currentJob = jobId; controller = new AbortController(); onState({ phase: 'cooking', step: 'queued', revision: id });
      inspect(jobId, id, controller.signal).catch(error => fail(error, id));
    },
    cancel() { clear(); cancelRemote(currentJob); currentJob = null; onJob(null); onState({ phase: 'idle', revision: ++revision }); },
    dispose() { clear(); revision += 1; },
  };
}

export function kitchenStatus({ count, job, hasResult, hasLogo = false, hasBrief = false }) {
  if (job.phase === 'error') return job.error;
  if (job.phase === 'pouring') return 'รับวัตถุดิบใหม่แล้ว…';
  if (job.phase === 'cooking') return ({
    analyzing: 'กำลังอ่านวัตถุดิบและคิดคอนเซปต์…',
    generating: 'กำลังสร้างภาพแบรนด์ของคุณ…',
    saving: 'กำลังจัดเก็บสูตรและภาพ…',
    reconnecting: 'กำลังเชื่อมต่อกับงานเดิมอีกครั้ง…',
  }[job.step] || 'กำลังปรุงแบรนด์ของคุณ…');
  if (job.phase === 'ready') return 'เสิร์ฟแล้ว! นี่แหละรสชาติของคุณ';
  if (count === 0) return 'ใส่วัตถุดิบแรกกันเลย';
  if (count === 1 && hasLogo) return hasBrief ? 'โลโก้และไอเดียพร้อมแล้ว · กด Shake เพื่อปรุง' : 'เติมคำบรรยายให้โลโก้ แล้วกด Shake เพื่อปรุง';
  if (count === 1) return 'อีก 1 อย่าง แล้วเราจะเริ่มปรุงให้';
  return hasResult ? 'เติมไอเดีย หรือ Shake เพื่อปรุงอีกครั้ง' : 'พร้อมแล้ว · กด Shake เพื่อปรุง';
}
