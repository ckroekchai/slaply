import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookmarkSimple, DownloadSimple, FileCode, FileText, Flask, Image, Sparkle, Trash, ArrowCounterClockwise, Check, X } from '@phosphor-icons/react';
import './studio-panels.css';
import { asset } from './assets.js';

const TITLES = { system: 'ปรุงแบรนด์ด้วย AI', export: 'เช็คบิล', recipes: 'สูตรที่เป็นคุณ', chef: 'อธิบายเชฟ' };
const KICKERS = { system: 'SLAPLY AI BETA', export: 'YOUR BRANDING GUIDELINE', recipes: 'YOUR RECIPE BOOK', chef: 'A NOTE TO THE CHEF' };
export default function StudioPanels({ panel, onClose, session, recipe = {}, onExport, history = [], onRestore, onSave, recipes = [], onLoadRecipe, isSaved = false, saving = false, trashedRecipes = [], onLoadTrash, onTrashRecipe, onRestoreTrashedRecipe, onPermanentlyDeleteRecipe, brief = {}, ingredients = [], onBriefChange, onIngredientNoteChange }) {
  const dialogRef = useRef(null), closeRef = useRef(onClose), operation = useRef(false), generation = useRef(0);
  const [feedback, setFeedback] = useState(''), [working, setWorking] = useState(null);
  const [recipeView, setRecipeView] = useState('saved'), [lastTrashed, setLastTrashed] = useState(null), [deleteCandidate, setDeleteCandidate] = useState(null);
  closeRef.current = onClose;
  useEffect(() => {
    generation.current += 1; operation.current = false; setFeedback(''); setWorking(null); setRecipeView('saved'); setLastTrashed(null); setDeleteCandidate(null);
    if (!panel) return;
    const focus = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => dialogRef.current?.querySelector('[data-panel-close]')?.focus(), 0);
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const nodes = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input, textarea, [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); dialogRef.current.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { clearTimeout(timer); document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (focus instanceof HTMLElement && document.contains(focus)) focus.focus(); };
  }, [panel]);
  if (!panel) return null;
  const run = async (kind, action, success, onSuccess) => {
    if (operation.current) return;
    operation.current = true; const ownGeneration = generation.current; setWorking(kind); setFeedback('');
    try { const value = await action(); if (ownGeneration === generation.current) { setFeedback(success); onSuccess?.(value); } }
    catch (error) { if (ownGeneration === generation.current) setFeedback(error.message || 'ทำรายการไม่สำเร็จ กรุณาลองใหม่'); }
    finally { if (ownGeneration === generation.current) { operation.current = false; setWorking(null); } }
  };
  const name = recipe.name || 'แบรนด์ของคุณ';
  const shownRecipes = recipeView === 'trash' ? trashedRecipes : recipes;
  const remaining = session ? Math.min(session.remaining, session.globalRemaining) : '…';
  return <div className="sp-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`sp-dialog sp-dialog--${panel}`} role="dialog" aria-modal="true" aria-labelledby="sp-dialog-title" ref={dialogRef} tabIndex={-1}>
      <button className="sp-close" aria-label="ปิดหน้าต่าง" onClick={onClose} data-panel-close><X size={22}/></button>
      {panel === 'export' ? <header className="sp-bill-header"><div className="sp-bill-wordmark">Slaply<Sparkle size={24} weight="fill"/></div><span className="sp-bill-kicker">THE BRAND POT</span><div className="sp-bill-heading"><h2 id="sp-dialog-title">เช็คบิล</h2><span>AI BETA · ฟรี</span></div><p>ปรุงเสร็จแล้ว พร้อมเสิร์ฟ</p></header> : <header className="sp-header"><span className="sp-kicker"><Sparkle size={14} weight="fill"/> {KICKERS[panel]}</span><h2 id="sp-dialog-title">{TITLES[panel]}</h2><p>{panel === 'recipes' ? 'เก็บทิศทางที่ชอบ แล้วกลับมาปรุงต่อ' : panel === 'chef' ? 'AI อ่านภาพให้เอง คุณเติมความตั้งใจที่ภาพอาจบอกไม่ครบ' : 'จากวัตถุดิบของคุณ สู่คอนเซปต์และภาพแบรนด์ใหม่'}</p></header>}
      {panel === 'chef' && <div className="sp-chef-content">
        <label className="sp-chef-overall"><strong>อยากให้เชฟรู้</strong><span>บุคลิกแบรนด์ กลุ่มลูกค้า หรือสิ่งที่อยากให้เกิดขึ้นในงานนี้</span><textarea aria-label="คำอธิบายเชฟ" value={brief.chefNotes || ''} maxLength={2000} rows={5} placeholder="เช่น อยากให้ดูอบอุ่นแต่ร่วมสมัย ใช้กับร้านกาแฟเล็ก ๆ และหลีกเลี่ยงภาพที่ดูเด็กเกินไป" onChange={event=>onBriefChange('chefNotes',event.target.value)}/><small>{(brief.chefNotes||'').length} / 2000</small></label>
        <div className="sp-chef-ingredients">{ingredients.map((item,index)=>item&&<label key={item.id} className="sp-chef-ingredient"><img src={asset(item.src)} alt={item.name}/><span><strong>วัตถุดิบ {index+1}</strong><small>{item.locked?'ล็อกไว้ · รักษาต้นฉบับ':'ไม่ล็อก · AI ออกแบบใหม่ได้'}</small><textarea aria-label={`อธิบายวัตถุดิบ ${index+1}`} value={item.notes||''} maxLength={300} rows={2} placeholder="ภาพนี้สำคัญกับแบรนด์อย่างไร (ไม่จำเป็นต้องกรอก)" onChange={event=>onIngredientNoteChange(index,event.target.value)}/></span></label>)}</div>
        {!ingredients.some(Boolean)&&<p className="sp-chef-empty">เพิ่มวัตถุดิบแล้วกลับมาอธิบายแต่ละภาพได้</p>}
        <div className="sp-chef-bottom"><p>เขียนหรือแก้ได้โดยไม่เริ่ม Gen · พร้อมแล้วกด Shake my brand ที่หน้าหม้อ</p><button className="sp-button sp-button--mint" onClick={onClose}>กลับไปปรุง<ArrowRight size={17}/></button></div>
      </div>}
      {panel === 'system' && <div className="sp-system-content">
        <div className="sp-system-stats"><div><span>รอบทดลองที่เหลือวันนี้</span><strong>{remaining}<Sparkle size={25}/></strong></div><div><span>ทิศทางในครั้งนี้</span><strong>{history.length}<Flask size={25}/></strong></div><div><span>สูตรที่เก็บไว้</span><strong>{recipes.length}<BookmarkSimple size={25}/></strong></div></div>
        <ol className="sp-pipeline">{[
          { title: 'ผสมวัตถุดิบ 3–6 ภาพ', description: 'AI อ่านภาพและแยกประเภทให้เอง ล็อกภาพที่ต้องการรักษาต้นฉบับ แล้วเติมความต้องการในอธิบายเชฟ ภาพและคำบรรยายจะถูกส่งให้ OpenAI เพื่อประมวลผล', icon: Image },
          { title: 'AI คิดคอนเซปต์และสร้างภาพ', description: 'กด Shake เพื่อเริ่ม AI จะอ่านวัตถุดิบและคำอธิบาย แล้วออกแบบแบรนด์พร้อม Object 3 แบบ ภาพที่ล็อกจะรักษาต้นฉบับและแยกพื้นหลังเมื่อทำได้อย่างมั่นใจ ส่วนภาพที่ไม่ล็อกใช้เป็นแรงบันดาลใจในการออกแบบใหม่', icon: Flask },
          { title: 'ปรับให้เป็นคุณ', description: 'ปรับชื่อ ข้อความ สี และขนาดได้โดยไม่ต้องสร้างภาพใหม่ กด Shake เมื่อต้องการคอนเซปต์และภาพใหม่อีกครั้ง', icon: Sparkle },
          { title: 'เก็บสูตรและดาวน์โหลด', description: 'สูตรและไฟล์เก็บบน Slaply โดยเชื่อมกับเบราว์เซอร์นี้ ดาวน์โหลด JSON หรือ HTML เพื่อเก็บสำเนาของคุณ', icon: DownloadSimple },
        ].map(step => <li key={step.title}><step.icon size={24}/><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
        <p className="sp-footnote">ช่วง AI Beta ทดลองฟรี มีจำนวนรอบต่อวันเพื่อรักษาความพร้อมของระบบ งานที่เริ่มประมวลผลแล้วอาจนับรอบแม้คุณเปลี่ยนวัตถุดิบหรือกดหยุด ยังไม่มีการเรียกเก็บเงิน</p>
        {history.length > 0 && <div className="sp-history-section"><h3>ทิศทางล่าสุด</h3><div className="sp-history-list">{history.map(item => <button key={item.id} onClick={() => { onRestore(item); onClose(); }}><img src={asset(item.generatedImage || item.productImage)} alt=""/><span><strong>{item.name}</strong><small>{item.concept?.title}</small></span><ArrowRight size={17}/></button>)}</div></div>}
      </div>}
      {panel === 'export' && <div className="sp-bill-content">
        <div className="sp-bill-recipe"><span>สูตรของ</span><h3>{name}</h3><p>{recipe.concept?.title || recipe.words}</p><div><span>{recipe.ingredients?.filter(Boolean).length || 0} วัตถุดิบ</span><span>1 ชุดแบรนด์</span></div></div>
        <div className="sp-bill-column-head"><span>รายการที่พร้อมเสิร์ฟ</span><span>ดาวน์โหลด</span></div>
        <ul className="sp-bill-items">{[
          { format: 'png', type: 'PNG', title: Number(recipe.schemaVersion)>=6?'Brand Guideline Board':'Artwork Art Direction', description: Number(recipe.schemaVersion)>=6?'บอร์ด 2400 × 1800 · sRGB พร้อมค่าที่ปรับไว้':'อาร์ตเวิร์ก 1600 × 1120 พร้อมค่าที่ปรับไว้' },
          { format: 'pdf', type: 'PDF', title: 'Brand Guideline PDF', description: Number(recipe.schemaVersion)>=6?'บอร์ดครบชุด 2400 × 1800 · sRGB':'บอร์ด Art Direction สำหรับเปิดดูและส่งต่อ' },
          { format: 'asset', type: 'PNG', title: recipe.brandObjects?.length?'ชุด Brand objects ทั้ง 3':'ภาพที่ AI สร้าง', description: 'ต้นฉบับความละเอียดเต็ม ใช้ประกอบงานต่อ' },
          ...(recipe.brandObjects||[]).map(object=>({format:object.id,type:'PNG',title:object.name,description:'Brand object · 512 × 512 · '+object.rationale})),
          { format: 'json', type: 'JSON', title: 'สูตรและวัตถุดิบ', description: Number(recipe.schemaVersion)>=6?'สูตร v6 · โลโก้ต้นฉบับ ภาพ AI และค่าบอร์ด':'สูตร ภาพต้นฉบับ ภาพ AI และค่าปรับแต่ง' },
          { format: 'html', type: 'HTML', title: 'Brand Guideline', description: 'ภาพ ฟอนต์ และแนวทางแบรนด์ เปิดออฟไลน์ได้' },
        ].filter(item => item.format !== 'asset' || recipe.generatedImage).map(item => <li key={item.format}><button disabled={!!working} onClick={() => run(item.format, () => onExport(item.format), 'เตรียมไฟล์แล้ว ดูได้ในรายการดาวน์โหลดของเบราว์เซอร์')} aria-label={`ดาวน์โหลด ${item.title}`}><span className="sp-bill-quantity">1</span><span className="sp-bill-item-name"><strong>{item.title}</strong><small>{item.description}</small></span><span className="sp-bill-file-type">{working === item.format ? 'กำลังเตรียม' : item.type}<DownloadSimple size={18} className={working === item.format ? 'sp-downloading' : ''}/></span></button></li>)}</ul>
        <div className="sp-bill-perforation" aria-hidden="true"/>
        <div className="sp-bill-total"><span>ยอดรวม<small>ทดลองใช้งาน AI Beta</small></span><strong>฿0</strong></div>
        <p className="sp-bill-free">ไม่มีการเรียกเก็บเงิน · เลือกดาวน์โหลดแต่ละรายการได้เลย</p>
        <div className="sp-bill-signoff"><Sparkle size={20} weight="fill"/><p>A LITTLE MIX. A LOT OF YOU.</p><span>ขอบคุณที่มาปรุงแบรนด์กับเรา</span></div>
        <p className="sp-bill-note">ไฟล์สำหรับงานดิจิทัล โปรดตรวจข้อความและรายละเอียดก่อนนำไปใช้<br/>ยังไม่ใช่ไฟล์บรรจุภัณฑ์พร้อมผลิต</p>
      </div>}
      {panel === 'recipes' && (deleteCandidate ? <div className="sp-delete-confirm" role="alert" aria-labelledby="delete-recipe-title"><Trash size={36}/><h3 id="delete-recipe-title">ลบสูตรนี้ถาวร?</h3><p>“{deleteCandidate.name}” จะถูกลบออกจากถังขยะและนำกลับมาไม่ได้</p><small>ไฟล์ที่คุณดาวน์โหลดไว้แล้วจะยังอยู่</small><div><button className="sp-button sp-button--outline" autoFocus disabled={!!working} onClick={()=>setDeleteCandidate(null)}>เก็บไว้ก่อน</button><button className="sp-button sp-button--danger" disabled={!!working} aria-label={`ยืนยันลบสูตร ${deleteCandidate.name} ถาวร`} onClick={()=>run('delete-'+deleteCandidate.id,()=>onPermanentlyDeleteRecipe(deleteCandidate.id),'ลบสูตรถาวรแล้ว',()=>{if(lastTrashed?.id===deleteCandidate.id)setLastTrashed(null);setDeleteCandidate(null)})}><Trash size={17}/>{working ? 'กำลังลบ…' : 'ลบถาวร'}</button></div></div> : <div className="sp-recipes-content">
        <div className="sp-save-current"><div><span className="sp-kicker">YOUR CURRENT RECIPE</span><h3>{recipe.id ? name : 'เริ่มจากวัตถุดิบที่เป็นคุณ'}</h3><p>{recipe.id ? recipe.concept?.title : 'ใส่วัตถุดิบอย่างน้อย 3 อย่าง แล้วกด Shake my brand'}</p></div><button className={`sp-button sp-button--mint ${isSaved ? 'is-saved' : ''}`} disabled={!!working || saving || !recipe.id || isSaved} onClick={() => run('save', onSave, 'เก็บสูตรแล้ว')}><BookmarkSimple size={18} weight={isSaved ? 'fill' : 'regular'} color={isSaved ? '#000000' : undefined}/>{working === 'save' || saving ? 'กำลังเก็บ…' : isSaved ? 'เก็บสูตรแล้ว' : 'เก็บสูตรนี้'}</button></div>
        <div className="sp-recipe-toolbar" aria-label="รายการสูตร"><div className="sp-recipe-views"><button className={recipeView === 'saved' ? 'selected' : ''} aria-pressed={recipeView === 'saved'} onClick={() => setRecipeView('saved')}><BookmarkSimple size={16}/>สูตรของฉัน <span>{recipes.length}</span></button><button className={recipeView === 'trash' ? 'selected' : ''} aria-pressed={recipeView === 'trash'} disabled={!!working} onClick={() => { setRecipeView('trash'); run('load-trash', onLoadTrash, ''); }}><Trash size={16}/>ถังขยะ{trashedRecipes.length > 0 && <span>{trashedRecipes.length}</span>}</button></div></div>
        {lastTrashed && <div className="sp-trash-undo" role="status"><span>ย้าย “{lastTrashed.name}” ไปถังขยะแล้ว</span><button disabled={!!working} onClick={() => run('restore-' + lastTrashed.id, () => onRestoreTrashedRecipe(lastTrashed.id), 'นำสูตรกลับมาแล้ว', () => setLastTrashed(null))}><ArrowCounterClockwise size={15}/>เลิกทำ</button></div>}
        {working === 'load-trash' ? <p className="sp-recipe-loading" role="status">กำลังเปิดถังขยะ…</p> : shownRecipes.length ? <div className="sp-recipe-grid">{shownRecipes.map(item => <article key={item.id} className="sp-saved-recipe">
          <button className="sp-recipe-open" disabled={recipeView === 'trash' || !!working} onClick={() => { onLoadRecipe(item); onClose(); }} aria-label={`เปิดสูตร ${item.name}`}><img src={asset(item.generatedImage || item.productImage)} alt={`ภาพแบรนด์ ${item.name}`}/><span className="sp-recipe-card-copy"><span className="sp-kicker">{recipeView === 'trash' ? 'IN THE BIN' : 'SAVED RECIPE'}</span><strong>{item.name}</strong><span>{item.concept?.title}</span>{recipeView === 'saved' && <span className="sp-recipe-load">เปิดสูตรนี้<ArrowRight size={17}/></span>}</span></button>
          <div className="sp-recipe-card-actions">{recipeView === 'trash' ? <><button className="sp-recipe-restore" disabled={!!working} onClick={() => run('restore-' + item.id, () => onRestoreTrashedRecipe(item.id), 'นำสูตรกลับมาแล้ว', () => { if(lastTrashed?.id === item.id)setLastTrashed(null); })}><ArrowCounterClockwise size={16}/>{working === 'restore-' + item.id ? 'กำลังกู้คืน…' : 'นำสูตรกลับมา'}</button><button className="sp-recipe-delete" disabled={!!working} aria-label={`ลบสูตร ${item.name} ถาวร`} title="ลบถาวร · นำกลับมาไม่ได้" onClick={()=>{setFeedback('');setDeleteCandidate({id:item.id,name:item.name})}}><Trash size={17}/>ลบถาวร</button></> : <button className="sp-recipe-trash" disabled={!!working} aria-label={`ย้ายสูตร ${item.name} ไปถังขยะ`} onClick={() => run('trash-' + item.id, () => onTrashRecipe(item.id), '', () => setLastTrashed({id:item.id,name:item.name}))}><Trash size={17}/>{working === 'trash-' + item.id ? 'กำลังย้าย…' : 'ทิ้งสูตร'}</button>}</div>
        </article>)}</div> : <div className="sp-empty">{recipeView === 'trash' ? <Trash size={45}/> : <BookmarkSimple size={45}/>}<h3>{recipeView === 'trash' ? 'ถังขยะยังว่างอยู่' : 'ที่ว่างสำหรับสูตรแรกของคุณ'}</h3><p>{recipeView === 'trash' ? 'สูตรที่ทิ้งไว้จะอยู่ที่นี่ และนำกลับมาได้' : 'ปรุงให้เสร็จ แล้วเก็บทิศทางที่ชอบไว้ได้เลย'}</p></div>}
        <p className="sp-footnote">{recipeView === 'trash' ? 'นำสูตรกลับมาได้ตราบใดที่ยังไม่ลบถาวร การลบถาวรจะเอาสูตรนี้กลับมาไม่ได้ ส่วนไฟล์ที่ดาวน์โหลดแล้วไม่ถูกลบ' : 'สูตรเชื่อมกับเบราว์เซอร์นี้ การล้างคุกกี้หรือใช้เบราว์เซอร์อื่นอาจทำให้เข้าถึงสูตรเดิมไม่ได้ ดาวน์โหลด JSON หรือ HTML เก็บเป็นสำเนาได้เสมอ'}</p>
      </div>)}
      {feedback && <p className="sp-feedback" role="status">{feedback}</p>}
    </section>
  </div>;
}
