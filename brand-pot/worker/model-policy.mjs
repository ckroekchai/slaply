// Explicit server-owned policy. Requests cannot select models or increase image count.
export const PRICING_VERSION = 'openai-standard-2026-11-05.1';
export const DEFAULT_MODEL_POLICY = Object.freeze({
  text: 'gpt-6-luna', image: 'gpt-image-2.6-flare',
  imageQuality: 'low', imageComplexity: 'low', imageSize: '1024x1024', imageCount: 1,
});
export function modelPolicy(env = {}) {
  const policy = {
    text: env.OPENAI_BRAND_MODEL || DEFAULT_MODEL_POLICY.text,
    image: env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL_POLICY.image,
    imageQuality: env.OPENAI_IMAGE_QUALITY || DEFAULT_MODEL_POLICY.imageQuality,
    imageComplexity: env.OPENAI_IMAGE_COMPLEXITY || DEFAULT_MODEL_POLICY.imageComplexity,
    imageSize: env.OPENAI_IMAGE_SIZE || DEFAULT_MODEL_POLICY.imageSize,
    imageCount: 1,
  };
  // Adding a provider/model is an explicit code and evaluation change, never a fallback.
  if (policy.text !== 'gpt-6-luna' || policy.image !== 'gpt-image-2.6-flare' ||
      !['low','medium','high','xhigh','max'].includes(policy.imageQuality) ||
      !['low','medium','high'].includes(policy.imageComplexity) ||
      !['1024x1024','1024x1536','1536x1024'].includes(policy.imageSize)) {
    const error = new Error('Unsupported AI model policy');
    error.code = 'AI_CONFIGURATION'; throw error;
  }
  return policy;
}
const tokens = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
export function estimateUsageCost(model, usage) {
  const result = { currency:'USD', amount:null, pricingVersion:PRICING_VERSION, basis:'reported-token-usage', estimated:true };
  if (!usage || typeof usage !== 'object') return {...result,reason:'usage_unavailable'};
  const input=tokens(usage.input_tokens), output=tokens(usage.output_tokens);
  if (input===null || output===null) return {...result,reason:'usage_incomplete'};
  if (model==='gpt-6-luna') {
    const details=usage.input_tokens_details||{};
    const cached=details.cached_tokens===undefined?0:tokens(details.cached_tokens);
    const writes=details.cache_write_tokens===undefined?0:tokens(details.cache_write_tokens);
    if(cached===null||writes===null||cached+writes>input)return {...result,reason:'usage_invalid'};
    // Cache hits and writes are disjoint subsets of total input, not surcharges
    // on top of the same ordinary-input tokens. Long-context rates apply to the
    // whole request, including all input/cache categories, strictly above 272K.
    const longContext=input>272_000;
    const rates={input:.10*(longContext?2:1),cachedInput:.01*(longContext?2:1),cacheWrite:.125*(longContext?2:1),output:.50*(longContext?1.5:1)};
    return {...result,amount:((input-cached-writes)*rates.input+cached*rates.cachedInput+writes*rates.cacheWrite+output*rates.output)/1_000_000,ratesPerMillion:rates,longContext};
  }
  if(model==='gpt-image-2.6-flare'){
    const text=tokens(usage.input_tokens_details?.text_tokens), image=tokens(usage.input_tokens_details?.image_tokens);
    if(text===null || image===null || text+image!==input)return {...result,reason:'usage_incomplete'};
    // Direct Images API: do not assume cache discounts that usage does not establish.
    return {...result,amount:(text*5+image*8+output*30)/1_000_000,ratesPerMillion:{textInput:5,imageInput:8,output:30}};
  }
  return {...result,reason:'unpriced_model'};
}
export function summarizeUsage(entries = {}) {
  const stages=['vision','image'].flatMap(stage=>entries[stage]?[{stage,model:entries[stage].model,usage:entries[stage].usage||null,cost:entries[stage].cost||estimateUsageCost(entries[stage].model,entries[stage].usage)}]:[]);
  const complete=stages.length===2&&stages.every(entry=>typeof entry.cost.amount==='number');
  return {stages,estimatedCostUSD:complete?stages.reduce((sum,entry)=>sum+entry.cost.amount,0):null,costComplete:complete,pricingVersion:PRICING_VERSION};
}
