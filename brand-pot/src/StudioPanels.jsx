import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookmarkSimple, DownloadSimple, FileCode, FileText, Flask, Image, Sparkle, X } from '@phosphor-icons/react';
import './studio-panels.css';
import { asset } from './assets.js';

const TITLES = { system: 'ปรุงแบรนด์ด้วย AI', export: 'พร้อมนำไปใช้', recipes: 'สูตรที่เป็นคุณ' };
const KICKERS = { system: 'SLAPLY AI BETA', export: 'YOUR BRANDING GUIDELINE', recipes: 'YOUR RECIPE BOOK' };
export default function StudioPanels({ panel, onClose, session, recipe = {}, onExport, history = [], onRestore, onSave, recipes = [], onLoadRecipe }) {
  const dialogRef = useRef(null), closeRef = useRef(onClose), operation = useRef(false), generation = useRef(0);
  const [feedback, setFeedback] = useState(''), [working, setWorking] = useState(null);
  closeRef.current = onClose;
  useEffect(() => {
    generation.current += 1; operation.current = false; setFeedback(''); setWorking(null);
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
  const run = async (kind, action, success) => {
    if (operation.current) return;
    operation.current = true; const ownGeneration = generation.current; setWorking(kind); setFeedback('');
    try { await action(); if (ownGeneration === generation.current) setFeedback(success); }
    catch (error) { if (ownGeneration === generation.current) setFeedback(error.message || 'ทำรายการไม่สำเร็จ กรุณาลองใหม่'); }
    finally { if (ownGeneration === generation.current) { operation.current = false; setWorking(null); } }
  };
  const name = recipe.name || 'แบรนด์ของคุณ';
  const remaining = session ? Math.min(session.remaining, session.globalRemaining) : '…';
  return <div className="sp-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`sp-dialog sp-dialog--${panel}`} role="dialog" aria-modal="true" aria-labelledby="sp-dialog-title" ref={dialogRef} tabIndex={-1}>
      <button className="sp-close" aria-label="ปิดหน้าต่าง" onClick={onClose} data-panel-close><X size={22}/></button>
      <header className="sp-header"><span className="sp-kicker"><Sparkle size={14} weight="fill"/> {KICKERS[panel]}</span><h2 id="sp-dialog-title">{TITLES[panel]}</h2><p>{panel === 'export' ? `ดาวน์โหลดสูตรและภาพของ ${name}` : panel === 'recipes' ? 'เก็บทิศทางที่ชอบ แล้วกลับมาปรุงต่อ' : 'จากวัตถุดิบของคุณ สู่คอนเซปต์และภาพแบรนด์ใหม่'}</p></header>
      {panel === 'system' && <div className="sp-system-content">
        <div className="sp-system-stats"><div><span>รอบทดลองที่เหลือวันนี้</span><strong>{remaining}<Sparkle size={25}/></strong></div><div><span>ทิศทางในครั้งนี้</span><strong>{history.length}<Flask size={25}/></strong></div><div><span>สูตรที่เก็บไว้</span><strong>{recipes.length}<BookmarkSimple size={25}/></strong></div></div>
        <ol className="sp-pipeline">{[
          { title: 'ใส่วัตถุดิบ 2–6 ภาพ', description: 'รูปต้นฉบับเก็บแยกจากภาพที่ AI สร้าง โดยไม่วาดทับสินค้าของคุณ ภาพและคำบรรยายจะถูกส่งให้ OpenAI เพื่อประมวลผล', icon: Image },
          { title: 'AI คิดคอนเซปต์และสร้างภาพ', description: 'AI อ่านวัตถุดิบ ชื่อและคำบรรยาย แล้วสร้างทิศทางภาพใหม่ งานที่ล็อกไว้จะมีน้ำหนักมากขึ้น สิ่งที่ AI ตีความควรตรวจทานก่อนนำไปใช้', icon: Flask },
          { title: 'ปรับให้เป็นคุณ', description: 'ปรับชื่อ ข้อความ สี และขนาดได้โดยไม่ต้องสร้างภาพใหม่ กด Shake เมื่อต้องการคอนเซปต์และภาพใหม่อีกครั้ง', icon: Sparkle },
          { title: 'เก็บสูตรและดาวน์โหลด', description: 'สูตรและไฟล์เก็บบน Slaply โดยเชื่อมกับเบราว์เซอร์นี้ ดาวน์โหลด JSON หรือ HTML เพื่อเก็บสำเนาของคุณ', icon: DownloadSimple },
        ].map(step => <li key={step.title}><step.icon size={24}/><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
        <p className="sp-footnote">ช่วง AI Beta ทดลองฟรี มีจำนวนรอบต่อวันเพื่อรักษาความพร้อมของระบบ งานที่เริ่มประมวลผลแล้วอาจนับรอบแม้คุณเปลี่ยนวัตถุดิบหรือกดหยุด ยังไม่มีการเรียกเก็บเงิน</p>
        {history.length > 0 && <div className="sp-history-section"><h3>ทิศทางล่าสุด</h3><div className="sp-history-list">{history.map(item => <button key={item.id} onClick={() => { onRestore(item); onClose(); }}><img src={asset(item.generatedImage || item.productImage)} alt=""/><span><strong>{item.name}</strong><small>{item.concept?.title}</small></span><ArrowRight size={17}/></button>)}</div></div>}
      </div>}
      {panel === 'export' && <div className="sp-export-content">
        <div className="sp-export-intro">{recipe.generatedImage && <img src={asset(recipe.generatedImage)} alt={`ภาพแบรนด์ ${name}`}/>}<div><span className="sp-kicker">READY WHEN YOU ARE</span><h3>{name}</h3><p>{recipe.concept?.summary || recipe.words}</p></div></div>
        <div className="sp-export-options">{[
          { format: 'png', icon: Image, title: 'Artwork Art Direction', description: 'ภาพอาร์ตเวิร์ก 1600 × 1120 พร้อมข้อความและค่าที่คุณปรับ' },
          { format: 'asset', icon: Sparkle, title: 'ภาพที่ AI สร้าง', description: 'ไฟล์ภาพต้นฉบับความละเอียดเต็ม สำหรับใช้ประกอบงานต่อ' },
          { format: 'json', icon: FileText, title: 'สูตรและวัตถุดิบ', description: 'JSON รวมสูตร ภาพต้นฉบับ ภาพ AI และค่าปรับแต่งทั้งหมด' },
          { format: 'html', icon: FileCode, title: 'Brand Guideline', description: 'HTML รวมภาพ ฟอนต์ และแนวทางแบรนด์ เปิดได้โดยไม่ต้องออนไลน์' },
        ].filter(item => item.format !== 'asset' || recipe.generatedImage).map(item => <button key={item.format} className="sp-export-option" disabled={!!working} onClick={() => run(item.format, () => onExport(item.format), 'เตรียมไฟล์แล้ว ดูได้ในรายการดาวน์โหลดของเบราว์เซอร์')}><span className="sp-export-icon"><item.icon size={26}/></span><span><strong>{item.title}</strong><small>{item.description}</small></span><DownloadSimple size={22} className={working === item.format ? 'sp-downloading' : ''}/></button>)}</div>
        <p className="sp-footnote">ไฟล์สำหรับงานดิจิทัล ตรวจข้อความและรายละเอียดก่อนนำไปใช้ ไฟล์นี้ยังไม่ใช่ไฟล์บรรจุภัณฑ์พร้อมผลิต</p>
      </div>}
      {panel === 'recipes' && <div className="sp-recipes-content">
        <div className="sp-save-current"><div><span className="sp-kicker">YOUR CURRENT RECIPE</span><h3>{recipe.id ? name : 'เริ่มจากวัตถุดิบที่เป็นคุณ'}</h3><p>{recipe.id ? recipe.concept?.title : 'ใส่ภาพอย่างน้อย 2 ภาพ แล้วรอให้ปรุงเสร็จ'}</p></div><button className="sp-button sp-button--mint" disabled={!!working || !recipe.id} onClick={() => run('save', onSave, 'เก็บสูตรบน Slaply แล้ว')}><BookmarkSimple size={18}/>{working === 'save' ? 'กำลังเก็บ…' : 'เก็บสูตรนี้'}</button></div>
        {recipes.length ? <div className="sp-recipe-grid">{recipes.map(item => <button key={item.id} className="sp-saved-recipe" onClick={() => { onLoadRecipe(item); onClose(); }}><img src={asset(item.generatedImage || item.productImage)} alt={`ภาพแบรนด์ ${item.name}`}/><div><span className="sp-kicker">SAVED RECIPE</span><h3>{item.name}</h3><p>{item.concept?.title}</p><span className="sp-recipe-load">เปิดสูตรนี้<ArrowRight size={17}/></span></div></button>)}</div> : <div className="sp-empty"><BookmarkSimple size={45}/><h3>ที่ว่างสำหรับสูตรแรกของคุณ</h3><p>ปรุงให้เสร็จ แล้วเก็บทิศทางที่ชอบไว้ได้เลย</p></div>}
        <p className="sp-footnote">สูตรเชื่อมกับเบราว์เซอร์นี้ การล้างคุกกี้หรือใช้เบราว์เซอร์อื่นอาจทำให้เข้าถึงสูตรเดิมไม่ได้ ดาวน์โหลด JSON หรือ HTML เก็บเป็นสำเนาได้เสมอ</p>
      </div>}
      {feedback && <p className="sp-feedback" role="status">{feedback}</p>}
    </section>
  </div>;
}
