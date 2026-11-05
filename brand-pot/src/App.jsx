import React,{useState,useRef,useEffect} from 'react';
import {Sparkle,ArrowRight,ArrowDown,Plus,X,Coins,BookmarkSimple,Check,ArrowCounterClockwise,SpeakerHigh,SpeakerSlash,Pause,Play,Info,Sun,Moon,CaretLeft,CaretRight,Carrot,Egg,Pepper,Jar,Leaf,OrangeSlice,LockSimple,LockSimpleOpen,TextT,ArrowsOut,Palette,SunDim,Drop,Receipt} from '@phosphor-icons/react';
import StudioPanels from './StudioPanels.jsx';
import {exportBrand} from './export-brand.js';
import {asset} from './assets.js';
import {createKitchenJobs,kitchenStatus} from './kitchen-jobs.js';
import PotLiquid from './PotLiquid.jsx';
import BrandGuideline,{GuidelineDetails,BrandObjectPreview,GeneratedObjectPicker} from './BrandGuideline.jsx';
import {DEFAULT_CUSTOMIZATION,DEFAULT_BOARD_CUSTOMIZATION,normalizeCustomization,BRAND_OBJECTS,buildGuidelineModel} from './brand-guideline-model.js';
import {apiRequest,normalizeRecipe,loadKitchenSession} from './api.js';
import {buildBrandConcept} from './brand-concept.js';
import {isRecipeSaved,persistRecipeSnapshot,moveSavedRecipe,upsertRecipe,applyRecipeMove} from './recipe-state.js';
import {BOARD_TEMPLATES,BOARD_FONT_PAIRS,buildBrandBoardScene} from './brand-board-scene.js';
import {inspectLogoSource} from './logo-backdrop.js';
import {INGREDIENT_ROLES,canCookIngredients,assignIngredientRole,uploadIngredientRole} from './ingredient-roles.js';
import {uploadIngredient} from './upload-ingredient.js';
import {uploadValidationMessage,uploadAccept} from './upload-limits.js';
const INGREDIENT_ICONS=[{Icon:Carrot,name:'แครอท'},{Icon:Egg,name:'ไข่'},{Icon:Pepper,name:'พริก'},{Icon:Jar,name:'น้ำผึ้ง'},{Icon:Leaf,name:'สมุนไพร'},{Icon:OrangeSlice,name:'ซิตรัส'}];
const A='/assets/';
const MOODS=[
{id:'fresh',title:'Fresh from your imagination.',image:A+'poko-fresh.png',paper:'#c8ead5',ink:'#153d2c',palette:['#a7dcbf','#ffc3a2','#214c35'],tagline:'Small can.\nBig mood.'},
{id:'bold',title:'A little extra personality.',image:A+'poko-bold.png',paper:'#1645df',ink:'#fff3df',palette:['#1645df','#ff974c','#fff4d7'],tagline:'A little louder.\nA lot more you.'},
{id:'luxe',title:'Made with your kind of taste.',image:A+'poko-luxe.png',paper:'#492b43',ink:'#fff1e2',palette:['#4a293e','#d0a8c2','#f3dec6'],tagline:'Your everyday.\nElevated.'}];
const moodOf=id=>MOODS.find(x=>x.id===id)||MOODS[0];
const empty=()=>Array(6).fill(null);
const loadActive=()=>{try{return sessionStorage.getItem('slaply-active-job')}catch{return null}};
const autoTheme=()=>new Date().getHours()>=18||new Date().getHours()<6?'night':'day';
const loadTheme=()=>{try{return localStorage.getItem('slaply-theme')||'auto'}catch{return 'auto'}};
export function App(){
 const [ingredients,setIngredients]=useState(empty),[active,setActive]=useState(0),[shake,setShake]=useState(0),[job,setJob]=useState({phase:'idle',revision:0});
 const [result,setResult]=useState(null),[history,setHistory]=useState([]),[panel,setPanel]=useState(null);
 const [recipeLists,setRecipeLists]=useState({recipes:[],trash:[]});
 const recipes=recipeLists.recipes,trashedRecipes=recipeLists.trash;
 function setRecipes(value){setRecipeLists(state=>({...state,recipes:typeof value==='function'?value(state.recipes):value}))}
 function setTrashedRecipes(value){setRecipeLists(state=>({...state,trash:typeof value==='function'?value(state.trash):value}))}
 const [bootstrapAttempt,setBootstrapAttempt]=useState(0),restoringJob=useRef(false);
 const [logoQuality,setLogoQuality]=useState(null);
 const [session,setSession]=useState(null),[connectionError,setConnectionError]=useState(''),[saving,setSaving]=useState(false);
 const savePromise=useRef(null);
 const [brief,setBrief]=useState({name:'',words:''}),[toast,setToast]=useState('');
 const [themeMode,setThemeMode]=useState(loadTheme),[timeTheme,setTimeTheme]=useState(autoTheme),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[sound,setSound]=useState(false);
 const [emphasis,setEmphasis]=useState(Array(6).fill(false)),emphasisRef=useRef(Array(6).fill(false));
 const [pour,setPour]=useState(null),[dragging,setDragging]=useState(false),[reading,setReading]=useState(false);
 const fileInput=useRef(null),carousel=useRef(null),cards=useRef([]),activeRef=useRef(0),fileSlot=useRef(0),fileVersions=useRef(Array(6).fill(0)),readEpoch=useRef(0),pendingReads=useRef(new Set());
 const scrollTimer=useRef(null),toastTimer=useRef(null),pourTimer=useRef(null),skipNext=useRef(false),lastStarted=useRef({ingredients:null,shake:-1}),mixNumber=useRef(0),callbacks=useRef({}),runner=useRef(null),scrollLock=useRef(0);
 const allowDocuments=session?.uploads?.documents===true;
 const count=ingredients.filter(Boolean).length,busy=job.phase==='cooking'||job.phase==='pouring',theme=themeMode==='auto'?timeTheme:themeMode;
 const isBoard=Number(result?.schemaVersion)>=6,canCook=canCookIngredients(ingredients,brief),hasLogo=ingredients.some(item=>item?.role==='logo');
 const inputLogo=ingredients.find(item=>item?.role==='logo');
 useEffect(()=>{let alive=true;const source=inputLogo?.src;setLogoQuality(null);if(source)inspectLogoSource(source).then(info=>{if(alive)setLogoQuality({source,warning:info.warning})}).catch(()=>{});return()=>{alive=false}},[inputLogo?.src]);
 const customization=normalizeCustomization(result?.customization);
 const display=result?{...result,format:'guideline',customization}:{};
 const concept=result?(result.concept||buildBrandConcept(result)):null;
 const isSaved=isRecipeSaved(display,recipes);
 const brandControlColor=result?(isBoard?buildBrandBoardScene(display,moodOf(result.mood)):buildGuidelineModel(display,moodOf(result.mood))).colors.ink:'#202442';
 function notify(message){setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3200)}
 function chime(){if(!sound)return;try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[392,523,659].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f;g.gain.setValueAtTime(.035,ctx.currentTime+i*.09);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.09+.3);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+i*.09);o.stop(ctx.currentTime+i*.09+.3)});setTimeout(()=>ctx.close(),700)}catch{}}
 async function refreshSession(){try{const data=await apiRequest('/api/session');setSession(data);setConnectionError('');return data}catch(error){setConnectionError(error.message);throw error}}
 callbacks.current={complete(recipe){
   const next=normalizeRecipe(recipe);setResult(next);setHistory(h=>[next,...h.filter(item=>item.id!==next.id)].slice(0,8));
   // A resumed job can finish after a reload with an empty mixing table.
   if(restoringJob.current||!ingredients.some(Boolean)){skipNext.current=true;setIngredients(next.ingredients);setBrief({name:next.name,words:next.words});emphasisRef.current=next.ingredients.map(item=>!!item?.locked);setEmphasis(emphasisRef.current)}
   restoringJob.current=false;refreshSession().catch(()=>{});chime();
 },error(error){restoringJob.current=false;notify(error.message);refreshSession().catch(()=>{})}};
 if(!runner.current)runner.current=createKitchenJobs({onState:setJob,onComplete:(recipe,id)=>callbacks.current.complete(recipe,id),onError:error=>callbacks.current.error(error),onJob:id=>{try{id?sessionStorage.setItem('slaply-active-job',id):sessionStorage.removeItem('slaply-active-job')}catch{}}});
 useEffect(()=>{
   let alive=true;
   loadKitchenSession(apiRequest,loadActive()).then(snapshot=>{
     if(!alive)return;
     const {session:data,recipes:saved,activeJobId,latestRecipe:latest}=snapshot;
     setRecipes(saved);setConnectionError('');
     if(activeJobId){restoringJob.current=true;runner.current.resume(activeJobId)}
     else if(latest){skipNext.current=true;setResult(latest);setIngredients(latest.ingredients);setBrief({name:latest.name,words:latest.words});emphasisRef.current=latest.ingredients.map(item=>!!item?.locked);setEmphasis(emphasisRef.current)}
     // Session readiness is committed only after restoration has been selected.
     setSession(data);
   }).catch(error=>{if(alive)setConnectionError(error.message)});
   return()=>{alive=false};
 },[bootstrapAttempt]);
 useEffect(()=>{
   if(!session||restoringJob.current)return;
   if(skipNext.current){skipNext.current=false;return}
   if(!canCook||reading){runner.current.cancel();return}
   if(session.remaining<=0||session.globalRemaining<=0){runner.current.cancel();notify('ใช้รอบทดลองครบแล้ว กลับมาปรุงใหม่พรุ่งนี้');return}
   if(lastStarted.current.ingredients===ingredients&&lastStarted.current.shake===shake)return;
   lastStarted.current={ingredients,shake};runner.current.start({ingredients:[...ingredients],brief:{...brief}});
   // Text is deliberately committed by Shake, while image changes cook automatically.
 },[ingredients,shake,reading,Boolean(session)]);
 useEffect(()=>()=>{runner.current.dispose();clearTimeout(toastTimer.current);clearTimeout(pourTimer.current);clearTimeout(scrollTimer.current)},[]);
 useEffect(()=>{const timer=setInterval(()=>setTimeTheme(autoTheme()),60000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{document.documentElement.style.colorScheme=theme==='night'?'dark':'light';document.body.style.background=theme==='night'?'#171a2d':'#fff9ee'},[theme]);
 useEffect(()=>{const el=carousel.current,card=cards.current[active];if(el&&card){scrollLock.current=Date.now()+650;el.scrollTo({left:card.offsetLeft-el.clientWidth/2+card.offsetWidth/2,behavior:reduced?'instant':'smooth'})}activeRef.current=active},[active,reduced]);
 function select(index,focus=false){const next=Math.max(0,Math.min(5,index));setActive(next);if(focus)cards.current[next]?.querySelector('.ingredient-card')?.focus({preventScroll:true})}
 function onScroll(){clearTimeout(scrollTimer.current);scrollTimer.current=setTimeout(()=>{if(Date.now()<scrollLock.current)return;const el=carousel.current;if(!el)return;const center=el.scrollLeft+el.clientWidth/2;let best=0,d=Infinity;cards.current.forEach((c,i)=>{const diff=Math.abs(c.offsetLeft+c.offsetWidth/2-center);if(diff<d){d=diff;best=i}});if(best!==activeRef.current){activeRef.current=best;setActive(best)}},180)}
 function pourInto(index,item){setActive(index);setIngredients(old=>old.map((x,i)=>i===index?{...item,role:uploadIngredientRole(old,index),locked:emphasisRef.current[index]}:x));setPour({id:Date.now(),index,src:item.src});clearTimeout(pourTimer.current);pourTimer.current=setTimeout(()=>setPour(null),1300)}
 function requestUpload(index){if(!session){notify('กำลังเชื่อมต่อ Slaply กรุณารอสักครู่');return}fileSlot.current=index;setActive(index);fileInput.current.value='';fileInput.current.click()}
 async function upload(file,index){
   if(!file)return;if(!session){notify('เชื่อมต่อ Slaply ก่อนอัปโหลด');return}const validationMessage=uploadValidationMessage(file,ingredients,index,{allowDocuments});if(validationMessage){notify(validationMessage);return}
   restoringJob.current=false;runner.current.cancel();lastStarted.current={ingredients:null,shake:-1};const epoch=readEpoch.current;const version=++fileVersions.current[index];const readId=Symbol();pendingReads.current.add(readId);setReading(true);
   try{const item=await uploadIngredient(file,{allowDocuments,isCurrent:()=>epoch===readEpoch.current&&version===fileVersions.current[index]});
     if(item&&epoch===readEpoch.current&&version===fileVersions.current[index])pourInto(index,item);
   }catch(error){notify(error.message||'อัปโหลดรูปนี้ไม่ได้ ลองใหม่อีกครั้ง')}finally{pendingReads.current.delete(readId);setReading(pendingReads.current.size>0)}
 }
 function removeIngredient(index){restoringJob.current=false;runner.current.cancel();lastStarted.current={ingredients:null,shake:-1};fileVersions.current[index]++;setIngredients(old=>old.map((x,i)=>i===index?null:x));setPour(null);if(count<=2)setResult(null)}
 function changeIngredientRole(index,role){restoringJob.current=false;runner.current.cancel();lastStarted.current={ingredients:null,shake:-1};setIngredients(old=>assignIngredientRole(old,index,role));setResult(null)}
 function toggleEmphasis(index){const next=emphasisRef.current.map((x,i)=>i===index?!x:x);emphasisRef.current=next;setEmphasis(next);if(ingredients[index])setIngredients(old=>old.map((item,i)=>i===index?{...item,locked:next[index]}:item));}
 function updateBrief(key,value){setBrief(b=>({...b,[key]:value}));if(result&&!busy)setResult(r=>{if(!r)return r;const concept=key==='name'&&r.name&&r.concept?{title:r.concept.title.split(r.name).join(value),summary:r.concept.summary.split(r.name).join(value)}:r.concept;return {...r,[key]:value,concept}})}
 function customize(key,value){setResult(r=>r?{...r,customization:{...normalizeCustomization(r.customization),[key]:value}}:r)}
 function toggleObject(style){setResult(r=>{if(!r)return r;const current=normalizeCustomization(r.customization);const objectStyles=current.objectStyles.includes(style)?current.objectStyles.filter(id=>id!==style):[...current.objectStyles,style];return {...r,customization:normalizeCustomization({...current,objectStyles})}})}
 function stop(){restoringJob.current=false;runner.current.cancel();notify('ส่งคำขอหยุดแล้ว · คุณปรุงสูตรใหม่ได้');refreshSession().catch(()=>{})}
 function goToResult(){document.getElementById('fresh-result')?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});document.getElementById('result-title')?.focus({preventScroll:true})}
 function doShake(){if(job.phase==='error'&&job.jobId){runner.current.resume(job.jobId);return}if(!canCook)return;setShake(s=>s+1)}
 function invalidateReads(){readEpoch.current++;pendingReads.current.clear();setReading(false)}
 function reset(){restoringJob.current=false;emphasisRef.current=Array(6).fill(false);setEmphasis(emphasisRef.current);invalidateReads();runner.current.cancel();setIngredients(empty());setResult(null);setActive(0);setPour(null);setBrief({name:'',words:''})}
 function restore(item){restoringJob.current=false;invalidateReads();runner.current.cancel();skipNext.current=true;const restored=Array.from({length:6},(_,i)=>item.ingredients?.[i]||null);lastStarted.current={ingredients:restored,shake};setIngredients(restored);emphasisRef.current=restored.map(x=>!!x?.locked);setEmphasis(emphasisRef.current);setResult(item);setBrief({name:item.name,words:item.words});setPanel(null);setActive(0);notify('เปิดสูตร '+item.name+' แล้ว · Shake เพื่อปรุงใหม่')}
 async function save(){
   if(!result)throw new Error('ปรุงแบรนด์ก่อนเก็บสูตร');
   if(savePromise.current)return savePromise.current;
   if(isSaved)return{persisted:true,alreadySaved:true};
   setSaving(true);
   const pending=persistRecipeSnapshot(display).then(saved=>{setRecipes(current=>upsertRecipe(current,saved.recipe));notify('เก็บสูตรแล้ว');return saved}).catch(error=>{notify(error.message);throw error}).finally(()=>{savePromise.current=null;setSaving(false)});
   savePromise.current=pending;return pending;
 }
 async function loadTrash(){const data=await apiRequest('/api/recipes?trash=1');const trash=(data.recipes||[]).map(normalizeRecipe);setTrashedRecipes(trash);return trash}
 async function trashRecipe(id){const recipe=await moveSavedRecipe(id);setRecipeLists(state=>applyRecipeMove(state,recipe));return recipe}
 async function restoreTrashedRecipe(id){const recipe=await moveSavedRecipe(id,true);setRecipeLists(state=>applyRecipeMove(state,recipe,true));return recipe}

 async function doExport(type){if(result)await exportBrand(display,moodOf(result.mood),type)}
 function setTheme(mode){setThemeMode(mode);try{localStorage.setItem('slaply-theme',mode)}catch{}}
 const status=kitchenStatus({count,job,hasResult:Boolean(result),hasLogo,hasBrief:Boolean(brief.words.trim())});
 return <div className={`kitchen-app ${reduced?'reduce-motion':''}`} data-theme={theme}>
 <div className="app-content" inert={panel?true:undefined}>
 <header className="topbar"><a className="wordmark" href="#kitchen" aria-label="Slaply home">Slaply<Sparkle weight="fill" size={23}/></a><span className="kitchen-label">THE BRAND POT</span><div className="nav-tools"><button className="recipe-nav" aria-label="สูตรของฉัน" onClick={()=>setPanel('recipes')}><BookmarkSimple size={17}/><span>สูตรของฉัน</span>{recipes.length>0&&<em>{recipes.length}</em>}</button><button className="theme-toggle" onClick={()=>setTheme(theme==='day'?'night':'day')} aria-label={theme==='day'?'Switch to night theme':'Switch to day theme'} title={theme==='day'?'เปลี่ยนเป็นกลางคืน':'เปลี่ยนเป็นกลางวัน'}>{theme==='day'?<Moon size={19}/>:sizeIconSun()}</button><button className="credit-pill" onClick={()=>setPanel('system')} aria-label="สถานะ AI Beta และรอบทดลอง"><Sparkle size={17}/><b>AI Beta</b><span>{session?`${Math.min(session.remaining,session.globalRemaining)} รอบ`:'…'}</span></button></div></header>
 <main id="kitchen">
 {connectionError&&<div className="connection-alert" role="alert"><span>{connectionError}</span><button onClick={()=>session?refreshSession().catch(()=>{}):setBootstrapAttempt(value=>value+1)}>เชื่อมต่ออีกครั้ง</button></div>}
 <section className="kitchen-hero"><div className="hero-copy"><span className="eyebrow">A LITTLE MIX. A LOT OF YOU.</span><h1>Good brands start<br className="mobile-break"/> with <span>good ingredients.</span></h1><p>ใส่โลโก้กับไอเดีย หรือผสมภาพ 2–6 อย่าง ให้เราปรุงแบรนด์ที่เป็นคุณ</p></div>
 <section className="ingredient-zone" aria-label="วัตถุดิบแบรนด์ สูงสุด 6 อย่าง"><div className="ingredient-heading"><span>วัตถุดิบของคุณ</span><span className={canCook?'count ready':'count'}><b>{count}</b> / 6</span></div>
 <p className="ingredient-limits">{allowDocuments?'JPG / PNG / WebP / SVG / PDF':'JPG / PNG / WebP'} · ไม่เกิน 5 MB ต่อไฟล์ และ 18 MB รวม · ภาพจะถูกส่งให้ AI</p>
 {allowDocuments&&<p className="ingredient-role-help">SVG แบบภาพนิ่งที่แปลงตัวอักษรเป็นเส้นแล้ว · PDF 1 หน้า</p>}
 <div className="carousel-shell"><button className="slide-arrow prev" disabled={active===0} aria-label="Previous ingredient" onClick={()=>select(active-1)}><CaretLeft size={21}/></button><div className="ingredient-carousel" ref={carousel} onScroll={onScroll} aria-label="เลือกวัตถุดิบ" onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();select(active+1,true)}if(e.key==='ArrowLeft'){e.preventDefault();select(active-1,true)}}}>
 {ingredients.map((item,i)=><div className={`ingredient-slot ${active===i?'active':''} ${item?'filled':''} ${emphasis[i]?'emphasized':''} ${pour?.index===i?'is-pouring':''}`} key={i} ref={el=>cards.current[i]=el}>
 <button className="ingredient-card" aria-label={`${item?'Change':'Upload'} ingredient ${i+1}${item?' '+item.name:''}`} aria-current={active===i?'true':undefined} onClick={()=>active===i?requestUpload(i):select(i)} onDragOver={e=>{e.preventDefault();setActive(i)}} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files[0],i)}}><span className="slot-number">0{i+1}</span>{item?<><img src={asset(item.src)} alt={item.name}/><span className="filled-label"><Check size={12}/> ลงหม้อแล้ว</span></>:<><IngredientIcon index={i}/><b>{i===0?'โลโก้ของคุณ':i===1?'แรงบันดาลใจ':'ปรุงรส'}</b><span>กดเพื่ออัปโหลด</span></>}</button>
 <button className={`ingredient-lock ${emphasis[i]?'locked':''}`} aria-label={`${emphasis[i]?'ปลดล็อก':'ล็อก'}วัตถุดิบ ${i+1} ให้โดดเด่น`} aria-pressed={emphasis[i]} title={emphasis[i]?'ล็อกแล้ว · เพิ่มน้ำหนักให้วัตถุดิบนี้':'ล็อกให้รสชาติและกลิ่นโดดเด่น'} onClick={()=>toggleEmphasis(i)}>{emphasis[i]?<LockSimple size={16} weight="fill"/>:<LockSimpleOpen size={16}/>}</button>
 {item&&<label className="ingredient-role"><select aria-label={`ประเภทวัตถุดิบ ${i+1}`} onKeyDown={e=>e.stopPropagation()} value={item.role||'reference'} onChange={e=>changeIngredientRole(i,e.target.value)}>{INGREDIENT_ROLES.map(role=><option key={role.id} value={role.id}>{role.label}</option>)}</select></label>}
 {item&&<button className="remove-ingredient" aria-label={`Remove ingredient ${i+1}`} onClick={()=>removeIngredient(i)}><X size={13}/></button>}
 </div>)}
 </div><button className="slide-arrow next" disabled={active===5} aria-label="Next ingredient" onClick={()=>select(active+1)}><CaretRight size={21}/></button></div>
 <div className="carousel-guide"><div className="slot-dots">{ingredients.map((it,i)=><button key={i} className={`${active===i?'active':''} ${it?'filled':''}`} onClick={()=>select(i)} aria-label={`Select ingredient ${i+1}`} aria-pressed={active===i}/>)}</div></div>
 <p className="ingredient-role-help">เลือกภาพโลโก้ 1 ภาพ แล้วเติมคำบรรยายข้างหม้อ · โลโก้ต้นฉบับจะไม่ถูกวาดใหม่</p>
 {logoQuality?.source===inputLogo?.src&&logoQuality?.warning&&<p className="logo-quality-hint" role="status"><Info size={15}/><span>{logoQuality.warning}</span></p>}
 <input ref={fileInput} type="file" hidden accept={uploadAccept({allowDocuments})} aria-label="Ingredient image file" onChange={e=>upload(e.target.files[0],fileSlot.current)}/>
 </section>
 <section className={`cooking-station ${busy?'is-cooking':''} ${pour?'is-pouring':''} ${dragging?'drop-ready':''}`} aria-label="หม้อสร้างแบรนด์" onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const slot=ingredients[active]?ingredients.findIndex(x=>!x):active;if(slot>=0)upload(e.dataTransfer.files[0],slot);else notify('ครบ 6 วัตถุดิบแล้ว · ลบหรือเปลี่ยนส่วนผสมก่อน')}}>
 <div className="pot-stage"><aside className="pot-note pot-name-note"><label htmlFor="brand-name"><span>ชื่อแบรนด์</span><input id="brand-name" value={brief.name} maxLength={80} placeholder="ชื่อแบรนด์ชื่อสินค้า" onChange={e=>updateBrief('name',e.target.value)}/></label><ArrowRight className="note-arrow" size={26} weight="light" aria-hidden="true"/></aside><aside className="pot-note pot-message-note"><label htmlFor="brand-seasoning"><span>เติมรสชาติด้วยข้อความ</span><textarea id="brand-seasoning" value={brief.words} maxLength={600} placeholder="บรรยายความรู้สึกลงไป" rows={3} onChange={e=>updateBrief('words',e.target.value)}/></label></aside><div className="pot-assembly"><img className="pot-image" src={asset(A+'brand-pot.png')} alt="หม้อ Slaply สีคอรัล มองเห็นน้ำด้านบน"/><img className="pot-emblem" src={asset(A+'brand-pot-v3.png')} alt="" aria-hidden="true"/><PotLiquid busy={busy} reduced={reduced}/>{pour&&<div className="pour-trail" key={pour.id} aria-hidden="true"><img src={asset(pour.src)} alt=""/><Sparkle weight="fill"/><Sparkle weight="fill"/></div>}</div></div>
 <div className="cooking-controls"><div className="cooking-status" role="status" aria-live="polite">{result&&!busy&&!reading?<button className="ready-result" onClick={goToResult} aria-controls="fresh-result"><span className="status-light"/><span>{status}</span><ArrowDown size={15}/></button>:<><span className={`status-light ${busy?'pulsing':''}`}/>{reading?'กำลังเตรียมภาพตัวอย่าง…':status}</>}</div><button className={`shake-button ${busy?'working':''}`} disabled={reading||(!job.jobId&&(!canCook||!session||session.remaining<=0||session.globalRemaining<=0))} onClick={doShake}><Sparkle size={20} weight="fill"/>{job.phase==='error'&&job.jobId?'ตรวจงานเดิมอีกครั้ง':busy?'Shake อีกครั้ง':'Shake my brand'}<span>{busy?'เริ่มรอบใหม่':'ทดลองฟรี'}</span></button>{busy&&<div className="below-shake"><span>เพิ่มวัตถุดิบได้เลย เราจะเริ่มจากสูตรล่าสุด</span><button onClick={stop}>หยุด</button></div>}</div>
 </section>
 </section>
 {result&&<section id="fresh-result" className={`fresh-result guideline-result ${busy?'updating':''}`}><div className="guideline-header"><div className="concept-copy"><span className="eyebrow">YOUR BRAND CONCEPT</span><h2 id="result-title" tabIndex={-1}>{concept.title}</h2><p>{concept.summary}</p></div><div className="guideline-actions"><button className={`keep-button ${isSaved?'is-saved':''}`} disabled={saving||isSaved} onClick={()=>save().catch(()=>{})}><BookmarkSimple size={17} weight={isSaved?'fill':'regular'} color={isSaved?'#000000':undefined}/>{saving?'กำลังเก็บ…':isSaved?'เก็บสูตรแล้ว':'เก็บสูตรนี้'}</button><button className="download-button" onClick={()=>setPanel('export')}><Receipt size={18}/>ดาวน์โหลด<ArrowRight size={17}/></button></div></div>
 <div className="result-workspace"><aside className="customize-sidebar" style={{'--brand-control-color':brandControlColor}} aria-label="ปรับแต่ง Branding Guideline"><div className="sidebar-heading"><span className="eyebrow">MAKE IT YOURS</span><h3>ปรับให้เป็นคุณ</h3></div><details className="concept-editor"><summary>แก้คอนเซปต์</summary><label>ชื่อคอนเซปต์<input aria-label="ชื่อคอนเซปต์" maxLength={120} value={concept.title} onChange={e=>setResult(r=>({...r,concept:{...concept,title:e.target.value}}))}/></label><label>สรุปแนวคิด<textarea aria-label="สรุปแนวคิด" maxLength={1000} rows={5} value={concept.summary} onChange={e=>setResult(r=>({...r,concept:{...concept,summary:e.target.value}}))}/></label></details>{isBoard?<><fieldset className="board-design-controls"><legend>ทิศทางของบอร์ด</legend><label>เลย์เอาต์<select aria-label="เลย์เอาต์บอร์ด" value={customization.layout||'auto'} onChange={e=>customize('layout',e.target.value)}><option value="auto">ตามสูตร AI</option>{BOARD_TEMPLATES.map(item=><option value={item.id} key={item.id}>{item.label} · {item.description}</option>)}</select></label><label>คู่ตัวอักษร<select aria-label="คู่ตัวอักษร" value={customization.fontPair||'auto'} onChange={e=>customize('fontPair',e.target.value)}><option value="auto">ตามสูตร AI</option>{BOARD_FONT_PAIRS.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>จังหวะพื้นที่<select aria-label="จังหวะพื้นที่" value={customization.density||'auto'} onChange={e=>customize('density',e.target.value)}><option value="auto">ตามสูตร AI</option><option value="airy">โปร่ง</option><option value="balanced">สมดุล</option><option value="compact">กระชับ</option></select></label><label>แพตเทิร์น<select aria-label="แพตเทิร์น" value={customization.pattern||'auto'} onChange={e=>customize('pattern',e.target.value)}><option value="auto">ตามสูตร AI</option><option value="repeat">ภาพซ้ำ</option><option value="tile">เรียงกริด</option><option value="stripe">แถบสี</option></select></label>{result.logo&&<label>พื้นหลังโลโก้<select aria-label="พื้นหลังโลโก้" value={customization.logoBackdrop||'auto'} onChange={e=>customize('logoBackdrop',e.target.value)}><option value="auto">อัตโนมัติจากโลโก้</option><option value="light">สว่าง</option><option value="dark">เข้ม</option></select></label>}<p>ปรับบอร์ดได้ทันทีโดยไม่ใช้รอบ AI · สีของโลโก้ต้นฉบับจะคงเดิม</p></fieldset><GeneratedObjectPicker recipe={result} customization={customization} onToggle={toggleObject}/></>:<fieldset className="brand-object-picker"><legend>Brand objects</legend><p>เลือกผสมกันได้หลายแบบ</p><div>{BRAND_OBJECTS.map(object=><button key={object.id} className={customization.objectStyles.includes(object.id)?'selected':''} aria-label={object.label} aria-pressed={customization.objectStyles.includes(object.id)} title={object.description} onClick={()=>toggleObject(object.id)}><BrandObjectPreview style={object.id}/>{customization.objectStyles.includes(object.id)&&<Check className="object-selected-check" size={11} weight="bold" aria-hidden="true"/>}<span>{object.label}</span></button>)}</div></fieldset>}<div className="customize-controls">{[
  ['textScale','ขนาดตัวอักษร',80,120,TextT,'%'],...(isBoard?[...(result.logo?[['logoScale','ขนาดโลโก้',70,115,ArrowsOut,'%']]:[]),...(result.brandObjects?.length?[['objectScale','ขนาดวัตถุแบรนด์',70,130,ArrowsOut,'%']]:[])]:[['objectScale','ขนาดวัตถุแบรนด์',70,130,ArrowsOut,'%']]),['hue','โทนสี',-60,60,Palette,'°'],['brightness','ความสว่าง',75,120,SunDim,'%'],['saturation','สด / หม่น',35,130,Drop,'%']
 ].map(([key,label,min,max,Icon,unit])=><label key={key}><span><Icon size={15}/>{label}<output>{customization[key]??100}{unit}</output></span><input type="range" aria-label={label} min={min} max={max} value={customization[key]??100} onChange={e=>customize(key,Number(e.target.value))}/></label>)}</div><button className="reset-customization" onClick={()=>setResult(r=>({...r,customization:{...(isBoard?DEFAULT_BOARD_CUSTOMIZATION:DEFAULT_CUSTOMIZATION)}}))}><ArrowCounterClockwise size={16}/>คืนค่าเริ่มต้น</button></aside>
 <div className="result-artwork-column"><div className="guideline-canvas"><BrandGuideline recipe={display} mood={moodOf(result.mood)}/>{busy&&<div className="guideline-updating" role="status">กำลังปรุงสูตรใหม่ · ด้านล่างคือทิศทางล่าสุด</div>}</div><section className="result-ingredients" aria-label="YOUR INGREDIENTS"><div className="result-ingredients-heading"><h3>YOUR INGREDIENTS</h3><span>{result.ingredients.filter(Boolean).length} วัตถุดิบในแบรนด์นี้</span></div><div className="result-ingredient-list">{result.ingredients.filter(Boolean).map((item,i)=><figure key={i}><div><img src={asset(item.src)} alt={item.name}/>{item.locked&&<span title="วัตถุดิบที่ล็อกให้โดดเด่น"><LockSimple size={12} weight="fill"/></span>}</div><figcaption title={item.name}>{item.name}</figcaption></figure>)}</div></section><GuidelineDetails recipe={display} mood={moodOf(result.mood)}/></div></div><p className="guideline-disclaimer">AI Brand Direction · ปรับแต่งข้อความและดาวน์โหลดได้ · ทดลองใช้งานฟรี</p></section>}

 </main>
 <footer><span>Small ingredients. Real possibilities.</span><div><button onClick={()=>setSound(x=>!x)} aria-label={sound?'Turn sound off':'Turn sound on'}>{sound?<SpeakerHigh size={16}/>:<SpeakerSlash size={16}/>}</button><button onClick={()=>setReduced(x=>!x)} aria-pressed={reduced} aria-label={reduced?'Enable motion':'Reduce motion'}>{reduced?<Play size={15}/>:<Pause size={15}/>}</button><button onClick={()=>setTheme('auto')} className={themeMode==='auto'?'auto-active':''}>สีตามเวลา</button><button onClick={()=>setPanel('system')}><Info size={15}/>เกี่ยวกับ AI Beta</button>{count>0&&<button onClick={reset} aria-label="Start a new recipe"><ArrowCounterClockwise size={15}/></button>}</div><p>AI Beta · รูปจะถูกส่งให้ AI เพื่อสร้างแบรนด์ · เก็บสูตรแยกตามเบราว์เซอร์</p></footer>
 {toast&&<div className="toast" role="status"><Check size={16}/>{toast}<button onClick={()=>setToast('')} aria-label="Dismiss notification"><X size={14}/></button></div>}
 </div>
 <StudioPanels panel={panel} onClose={()=>setPanel(null)} session={session} recipe={display} onExport={doExport} history={history} onRestore={restore} onSave={save} recipes={recipes} onLoadRecipe={restore} isSaved={isSaved} saving={saving} trashedRecipes={trashedRecipes} onLoadTrash={loadTrash} onTrashRecipe={trashRecipe} onRestoreTrashedRecipe={restoreTrashedRecipe}/>
 </div>
}
function sizeIconSun(){return <Sun size={19}/>}

function IngredientIcon({index}){const {Icon,name}=INGREDIENT_ICONS[index];return <Icon size={29} weight="duotone" role="img" aria-label={name} data-ingredient-icon={name}/>;}
