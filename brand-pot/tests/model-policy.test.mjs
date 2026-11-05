import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL_POLICY,modelPolicy,estimateUsageCost,summarizeUsage } from '../worker/model-policy.mjs';

test('explicit economical generation defaults have no fallback model or auto settings',()=>{
  assert.deepEqual(modelPolicy(),DEFAULT_MODEL_POLICY);
  assert.deepEqual(modelPolicy({OPENAI_IMAGE_QUALITY:'medium'}),{...DEFAULT_MODEL_POLICY,imageQuality:'medium'});
  for(const env of [{OPENAI_BRAND_MODEL:'gpt-unknown'},{OPENAI_IMAGE_MODEL:'gpt-image-expensive'},{OPENAI_IMAGE_QUALITY:'auto'},{OPENAI_IMAGE_COMPLEXITY:'auto'},{OPENAI_IMAGE_SIZE:'auto'}])assert.throws(()=>modelPolicy(env),error=>error.code==='AI_CONFIGURATION');
  assert.equal(modelPolicy({OPENAI_IMAGE_COUNT:'8'}).imageCount,1);
});
test('text estimate uses measured cached and uncached tokens with dated standard rates',()=>{
  const cost=estimateUsageCost('gpt-6-luna',{input_tokens:1000,input_tokens_details:{cached_tokens:100},output_tokens:500});
  assert.ok(Math.abs(cost.amount-.000341)<1e-12);assert.equal(cost.currency,'USD');assert.equal(cost.estimated,true);assert.match(cost.pricingVersion,/2026-11-05/);
});
test('direct image estimate counts distinct input modalities and image output tokens',()=>{
  const cost=estimateUsageCost('gpt-image-2.6-flare',{input_tokens:300,input_tokens_details:{text_tokens:200,image_tokens:100},output_tokens:400});
  assert.ok(Math.abs(cost.amount-.0138)<1e-12);assert.deepEqual(cost.ratesPerMillion,{textInput:5,imageInput:8,output:30});
});
test('unknown or missing usage is unknown cost, never a free or invented estimate',()=>{
  for(const [model,usage] of [['gpt-6-luna',null],['unknown',{input_tokens:1,output_tokens:1}],['gpt-image-2.6-flare',{input_tokens:1,output_tokens:1}],['gpt-6-luna',{input_tokens:-1,output_tokens:1}],['gpt-6-luna',{input_tokens:10,input_tokens_details:{cached_tokens:11},output_tokens:1}]])assert.equal(estimateUsageCost(model,usage).amount,null);
  assert.equal(summarizeUsage({vision:{model:'gpt-6-luna',usage:{input_tokens:0,output_tokens:0}}}).estimatedCostUSD,null);
});

test('actual Luna usage separates cache writes from ordinary input and cache hits',()=>{
  const actual={input_tokens:2943,input_tokens_details:{cache_write_tokens:2940,cached_tokens:0},output_tokens:1064};
  const cost=estimateUsageCost('gpt-6-luna',actual);
  assert.ok(Math.abs(cost.amount-.0008998)<1e-12);
  assert.equal(cost.ratesPerMillion.cacheWrite,.125);assert.equal(cost.longContext,false);
  assert.ok(Math.abs(cost.amount-.0008263-.0000735)<1e-12);
  const mixed=estimateUsageCost('gpt-6-luna',{input_tokens:1000,input_tokens_details:{cached_tokens:200,cache_write_tokens:300},output_tokens:500});
  assert.ok(Math.abs(mixed.amount-.0003395)<1e-12);
});
test('cache categories must be nonnegative integer subsets whose sum cannot exceed input',()=>{
  for(const details of [{cached_tokens:6,cache_write_tokens:5},{cache_write_tokens:-1},{cache_write_tokens:1.5},{cached_tokens:null},{cache_write_tokens:'3'}]){
    const result=estimateUsageCost('gpt-6-luna',{input_tokens:10,input_tokens_details:details,output_tokens:1});assert.equal(result.amount,null);assert.equal(result.reason,'usage_invalid');
  }
});
test('Luna long-context multipliers apply above 272K to the full request including caches',()=>{
  const exact=estimateUsageCost('gpt-6-luna',{input_tokens:272000,input_tokens_details:{cached_tokens:1000,cache_write_tokens:2000},output_tokens:1000});
  const above=estimateUsageCost('gpt-6-luna',{input_tokens:272001,input_tokens_details:{cached_tokens:1000,cache_write_tokens:2000},output_tokens:1000});
  assert.equal(exact.longContext,false);assert.equal(above.longContext,true);
  assert.deepEqual(above.ratesPerMillion,{input:.2,cachedInput:.02,cacheWrite:.25,output:.75});
  assert.ok(Math.abs(exact.amount-.02766)<1e-12);
  assert.ok(Math.abs(above.amount-.0550702)<1e-12);
});
