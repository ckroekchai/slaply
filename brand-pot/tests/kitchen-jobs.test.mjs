import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenJobs } from '../src/kitchen-jobs.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function clock() { let id=0;const pending=new Map();return {setTimeout(fn){pending.set(++id,fn);return id;},clearTimeout(id){pending.delete(id);},async next(){const [id,fn]=pending.entries().next().value||[];if(fn){pending.delete(id);await fn();await flush();}},get size(){return pending.size;}}; }
const payload={ingredients:[{id:'upload-a',locked:true},null,{id:'upload-b',locked:false}],brief:{name:'แบรนด์',words:'สดใส'}};

test('rapid ingredient edits submit only the latest brief after debounce',async()=>{
  const timer=clock(),submitted=[],completed=[];
  const request=async(path,options)=>{if(path==='/api/jobs'){submitted.push(JSON.parse(options.body));return{id:'job-new'}}return{status:'completed',recipe:{name:'ล่าสุด'}}};
  const runner=createKitchenJobs({clock:timer,request,makeKey:()=> 'key',onState(){},onComplete:r=>completed.push(r)});
  runner.start(payload);runner.start({...payload,brief:{name:'ล่าสุด',words:''}});await timer.next();
  assert.equal(submitted.length,1);assert.equal(submitted[0].brief.name,'ล่าสุด');assert.deepEqual(submitted[0].ingredients,[{id:'upload-a',locked:true},{id:'upload-b',locked:false}]);assert.equal(completed[0].name,'ล่าสุด');
});

test('superseded submission is cancelled after receiving its ID and never displays its recipe',async()=>{
  const timer=clock(),completed=[],cancelled=[];let resolveOld;
  const request=async(path,options)=>{if(path==='/api/jobs'){assert.equal(options.signal,undefined);return new Promise(resolve=>{resolveOld=resolve})}if(path.endsWith('/cancel')){cancelled.push(path);return{}}throw Error('Stale job must not be polled');};
  const runner=createKitchenJobs({clock:timer,request,makeKey:()=> 'key',onState(){},onComplete:r=>completed.push(r)});
  runner.start(payload);const pending=timer.next();await flush();runner.cancel();resolveOld({id:'old'});await pending;
  assert.deepEqual(cancelled,['/api/jobs/old/cancel']);assert.equal(completed.length,0);
});

test('stale polling result cannot overwrite a newer job',async()=>{
  const timer=clock(),completed=[];let resolveOldPoll,submits=0;
  const request=async(path)=>{if(path==='/api/jobs')return{id:++submits===1?'old':'new'};if(path.endsWith('/cancel'))return{};if(path==='/api/jobs/old')return new Promise(resolve=>{resolveOldPoll=resolve});return{status:'completed',recipe:{name:'new'}}};
  const runner=createKitchenJobs({clock:timer,request,makeKey:()=> 'key',onState(){},onComplete:r=>completed.push(r)});
  runner.start(payload);const old=timer.next();await flush();runner.start(payload);await timer.next();resolveOldPoll({status:'completed',recipe:{name:'old'}});await old;
  assert.deepEqual(completed,[{name:'new'}]);
});

test('provider failure is reported without manufacturing a result',async()=>{
  const timer=clock(),states=[],errors=[],completed=[];
  const runner=createKitchenJobs({clock:timer,makeKey:()=> 'key',request:async path=>path==='/api/jobs'?{id:'x'}:{status:'failed',error:{message:'AI quota unavailable'}},onState:s=>states.push(s),onError:e=>errors.push(e.message),onComplete:r=>completed.push(r)});
  runner.start(payload);await timer.next();assert.equal(states.at(-1).phase,'error');assert.deepEqual(errors,['AI quota unavailable']);assert.equal(completed.length,0);
});

test('resuming a durable job polls without spending another generation',async()=>{
  const calls=[],completed=[];
  const runner=createKitchenJobs({request:async path=>{calls.push(path);return{status:'completed',recipe:{id:'saved'}}},onState(){},onComplete:r=>completed.push(r)});
  runner.resume('saved');await flush();assert.deepEqual(calls,['/api/jobs/saved']);assert.equal(completed[0].id,'saved');
});

test('temporary polling errors reconnect to the same job without a second submission',async()=>{
  const timer=clock(),states=[],completed=[];let polls=0,submits=0;
  const request=async path=>{if(path==='/api/jobs'){submits++;return{id:'durable'}}if(++polls===1)throw new TypeError('Offline');return{status:'completed',recipe:{id:'durable'}}};
  const runner=createKitchenJobs({clock:timer,makeKey:()=> 'key',request,onState:s=>states.push(s),onComplete:r=>completed.push(r)});
  runner.start(payload);await timer.next();assert.equal(states.at(-1).step,'reconnecting');await timer.next();assert.equal(submits,1);assert.deepEqual(completed,[{id:'durable'}]);
});

test('exhausted reconnects keep a durable job available for explicit resume',async()=>{
  const timer=clock(),states=[],jobIds=[];
  const request=async path=>{if(path==='/api/jobs')return{id:'keep-me'};throw new TypeError('Offline')};
  const runner=createKitchenJobs({clock:timer,makeKey:()=> 'key',request,onState:s=>states.push(s),onJob:id=>jobIds.push(id),onComplete(){}});
  runner.start(payload);await timer.next();await timer.next();await timer.next();await timer.next();
  assert.equal(states.at(-1).phase,'error');assert.equal(states.at(-1).jobId,'keep-me');assert.deepEqual(jobIds,['keep-me']);
});
