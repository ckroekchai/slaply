import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, buildBrandBoardScene, layoutBrandBoardText, renderBrandBoardSVG, BOARD_FONT_CATALOG } from '../src/brand-board-scene.js';

const logo='/api/assets/test_logo_asset';
const palette=[['primary','#194D43'],['secondary','#D0C2E4'],['accent','#DC663C'],['paper','#FFF9EC'],['ink','#162925']].map(([role,hex])=>({role,hex,name:role}));
function recipe(overrides={}){
  return {
    schemaVersion:6,name:'บ้านสวน / BAAN SUAN',words:'อบอุ่น เรียบง่าย ให้ตัวตนเดิมชัดเจน',
    concept:{title:'ตัวตนที่ชัดเจน',summary:'ใช้รูปทรงและจังหวะของโลโก้เดิม เพื่อสร้างภาษาภาพที่ต่อเนื่องกัน'},
    logo:{assetId:'test_logo_asset',src:logo,width:1316,height:1073,sha256:'a'.repeat(64),mime:'image/png',preserveOriginal:true},
    ingredients:[{id:'test_logo_asset',src:logo,role:'logo',locked:true}],
    design:{template:'editorial',fontPair:'grotesk',imageStyle:'graphic',density:'balanced'},
    brandSystem:{palette,typography:{headingSample:'Good things, thoughtfully made.',bodySample:'เรียบง่าย อบอุ่น และจดจำได้'},pattern:{kind:'repeat'},applications:[{kind:'social',headline:'ช่วงเวลาดี ๆ เริ่มที่นี่',body:'รายละเอียดที่ทำให้วันธรรมดาพิเศษขึ้น'},{kind:'business-card',headline:'BAAN SUAN',body:'A considered point of view.'}]},
    customization:{objectStyles:[],hue:0,brightness:100,saturation:100},
    ...overrides,
  };
}
const geometry=scene=>scene.nodes.filter(n=>n.type==='image'||n.id.startsWith('palette-')).map(({id,type,bounds})=>({id,type,bounds}));

test('brand board has complete bounded geometry and five truthful palette swatches',()=>{
  assert.deepEqual(BOARD_SIZE,{width:2400,height:1800});
  for(const template of ['ai','minimal','professional','creative']){
    const input=recipe({design:{template:'editorial',fontPair:'grotesk',imageStyle:'graphic',density:'balanced'},customization:{boardVariant:template}}),original=structuredClone(input),scene=buildBrandBoardScene(input);
    assert.equal(scene.version,6);assert.deepEqual(scene.size,BOARD_SIZE);assert.equal(scene.templateId,template);
    assert(scene.nodes.length>15,'Complete board contains multiple content modules');
    assert.equal(new Set(scene.nodes.map(n=>n.id)).size,scene.nodes.length,'Every scene element has a stable unique ID');
    for(const node of scene.nodes){
      const b=node.bounds;assert(b&&[b.x,b.y,b.w,b.h].every(Number.isFinite),`${node.id} has finite bounds`);
      assert(b.w>=0&&b.h>=0&&b.x>=-.01&&b.y>=-.01&&b.x+b.w<=2400.01&&b.y+b.h<=1800.01,`${node.id} lies inside export bounds`);
    }
    for(const {role,hex} of palette){
      const swatch=scene.nodes.find(n=>n.id===`palette-${role}`),label=scene.nodes.find(n=>n.id===`palette-hex-${role}`);
      assert(swatch&&label,`${role} has both a swatch and a printed value`);
      assert.equal(swatch.fill.toUpperCase(),hex);assert(label.text.toUpperCase().includes(hex));
    }
    assert.deepEqual(input,original,'Rendering never mutates the saved source recipe');
  }
});

test('design choices change structure and actual font families rather than only names or colors',()=>{
  const templates=['ai','minimal','professional','creative'].map(template=>buildBrandBoardScene(recipe({design:{template:'editorial',fontPair:'grotesk',imageStyle:'graphic',density:'balanced'},customization:{boardVariant:template}})));
  assert.equal(new Set(templates.map(scene=>JSON.stringify(geometry(scene)))).size,4,'All four templates have distinct module placement');
  const fonts=['grotesk','editorial-serif','display'].map(fontPair=>buildBrandBoardScene(recipe({design:{template:'editorial',fontPair,imageStyle:'graphic',density:'balanced'}})));
  assert.equal(new Set(fonts.map(scene=>JSON.stringify(scene.fontFamilies))).size,3,'Font choices resolve to distinct families');
  for(const scene of fonts){
    assert(scene.nodes.some(n=>n.type==='text'&&Object.values(scene.fontFamilies).includes(n.fontFamily)),'Resolved catalog fonts are used by visible text');
  }
  assert(BOARD_FONT_CATALOG&&typeof BOARD_FONT_CATALOG==='object','Fonts come from a finite local catalog');
});

test('logo identity survives every layout, palette adjustment and logo size edit',()=>{
  for(const template of ['ai','minimal','professional','creative'])for(const settings of [{logoScale:70},{logoScale:115,hue:93,saturation:150,brightness:55}]){
    const input=recipe({design:{template:'editorial',fontPair:'editorial-serif',imageStyle:'material',density:'compact'},customization:{...settings,boardVariant:template}}),scene=buildBrandBoardScene(input);
    const assets=scene.assets.filter(a=>a.sourceRole==='logo'),nodes=scene.nodes.filter(n=>n.type==='image'&&n.sourceRole==='logo');
    assert(assets.length&&nodes.length,'Original logo is explicitly represented as an asset and image');
    for(const asset of assets){assert.equal(asset.src,logo);assert.equal(asset.preserveOriginal,true);}
    for(const node of nodes){
      assert.equal(node.assetRef,logo);assert.equal(node.fit,'contain');assert.equal(node.preserveOriginal,true);
      assert(!node.filter&&!node.crop&&!node.mask&&!node.clip,'Original logo cannot inherit decorative effects');
      assert(node.opacity===undefined||node.opacity===1,'Original logo color cannot be altered by opacity');
    }
    assert.equal(input.logo.sha256,'a'.repeat(64),'Source digest remains unchanged');
  }
});

test('rendered SVG keeps the supplied identity escaped and immutable logo references intact',()=>{
  const input=recipe({name:'ไทย <script>alert(1)</script> & BRAND'}),scene=buildBrandBoardScene(input);
  const svg=renderBrandBoardSVG(scene);
  assert.match(svg,/<svg\b/);assert.match(svg,/2400/);assert.match(svg,/1800/);
  assert(!svg.includes('<script>'),'User text cannot create executable markup');
  assert(svg.includes('&lt;script&gt;'),'Supplied name remains text rather than being silently removed');
  assert(svg.includes(logo),'Original logo remains referenced');
  assert(!svg.includes('foreignObject'),'Board uses explicit SVG geometry for predictable raster/PDF export');
});

test('saved board choice fixes its own art direction while preserving logo size and backdrop controls',()=>{
  const small=buildBrandBoardScene(recipe({customization:{boardVariant:'minimal',layout:'expressive',fontPair:'display',density:'compact',pattern:'stripe',logoBackdrop:'dark',logoScale:70}}));
  const large=buildBrandBoardScene(recipe({customization:{boardVariant:'minimal',layout:'expressive',fontPair:'display',density:'compact',pattern:'stripe',logoBackdrop:'dark',logoScale:115}}));
  assert.equal(small.templateId,'minimal');assert.equal(small.fontPairId,'grotesk');assert.equal(small.density,'airy');assert.equal(small.patternKind,'repeat');
  const backdrop=small.nodes.find(n=>n.id==='logo-panel').fill;
  const rgb=[1,3,5].map(i=>parseInt(backdrop.slice(i,i+2),16));assert(rgb.every(n=>n<64),'Dark backdrop remains dark after save/restore normalization');
  const a=small.nodes.find(n=>n.id==='identity-logo'),b=large.nodes.find(n=>n.id==='identity-logo');
  assert(b.bounds.w>a.bounds.w&&b.bounds.h>a.bounds.h,'Logo size override changes its containing geometry');
  assert.equal(a.assetRef,b.assetRef,'Resizing never substitutes the source');
});

test('Thai combining clusters survive text fitting without clipping or dropping supplied characters',()=>{
  const text='น้ำกึ่งหนึ่ง กุ้งกิ๊ง บ้านนี้มีเรื่องราว 👨‍👩‍👧‍👦 '.repeat(4).trim();
  const segmenter=new Intl.Segmenter('th',{granularity:'grapheme'}),clusters=value=>[...segmenter.segment(value)].map(x=>x.segment);
  const node={id:'thai-copy',type:'text',text,bounds:{x:20,y:20,w:420,h:140},fontFamily:'Noto Sans Thai',fontWeight:400,fontSize:30,minFontSize:16,lineHeight:1.4,fill:'#111111'};
  // Deterministic measurement tests wrapping only; actual glyph rendering is checked separately.
  const measure=(value,_node,size)=>clusters(value).length*size*.65;
  const output=layoutBrandBoardText({nodes:[node]},measure).nodes[0];
  assert.equal(output.lines.map(line=>line.text).join('').replace(/\s/g,''),text.replace(/\s/g,''),'All supplied characters survive');
  assert(output.lines.every(line=>measure(line.text,node,output.computedFontSize)<=node.bounds.w),'No line exceeds its allocated width');
  assert(output.lines.at(-1).y<=node.bounds.y+node.bounds.h,'Fitted lines remain inside their panel');
  for(const line of output.lines)assert(!/^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u200D]/u.test(line.text),'A new line cannot start with a detached combining mark');
});

test('mid-tone brand surfaces keep body copy readable and closing punctuation stays attached',()=>{
  const scene=buildBrandBoardScene(recipe({brandSystem:{palette:palette.map(p=>p.role==='primary'?{...p,hex:'#647BB3'}:p)}}));
  const text=scene.nodes.find(n=>n.id==='social-body'),surface=scene.nodes.find(n=>n.id==='application-social-panel');
  const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const a=luminance(text.fill),b=luminance(surface.fill);
  assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Suggested body ink meets its contrast target on a mid-tone brand color');
  const node={id:'punctuation',type:'text',text:'A point of view.',bounds:{x:0,y:0,w:310,h:140},fontSize:43,minFontSize:16,lineHeight:1.2};
  const fitted=layoutBrandBoardText({nodes:[node]},(value,_node,size)=>value.length*size*.55).nodes[0];
  assert(fitted.lines.every(line=>!/^\s*[.,!?;:]+\s*$/.test(line.text)),'Closing punctuation cannot occupy its own line');
  assert.equal(fitted.lines.map(l=>l.text).join('').replace(/\s/g,''),'Apointofview.');
});
