#!/usr/bin/env node
// Read-only verification of real exported bytes. No browser or provider requests.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

const run = promisify(execFile);
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const sharp = (await import(process.env.QA_SHARP_MODULE ? pathToFileURL(process.env.QA_SHARP_MODULE).href : 'sharp')).default;
const hex = value => /^#[\da-f]{6}$/i.test(value || '') ? [1,3,5].map(i => parseInt(value.slice(i,i+2),16)) : null;

function rgbAt(image, x, y) {
  const offset = (Math.floor(y) * image.info.width + Math.floor(x)) * image.info.channels;
  return [...image.data.subarray(offset, offset + 3)];
}
async function decode(file) {
  return sharp(file).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject:true });
}
function diff(left, right, predicate = () => true) {
  assert.equal(left.info.width, right.info.width, 'Compared raster widths match');
  assert.equal(left.info.height, right.info.height, 'Compared raster heights match');
  let total = 0, maximum = 0, overThree = 0, pixels = 0;
  for (let y=0;y<left.info.height;y++) for (let x=0;x<left.info.width;x++) {
    if (!predicate(x,y)) continue;
    const a=rgbAt(left,x,y),b=rgbAt(right,x,y),delta=a.map((n,i)=>Math.abs(n-b[i]));
    total+=delta.reduce((sum,n)=>sum+n,0);maximum=Math.max(maximum,...delta);overThree+=delta.some(n=>n>3)?1:0;pixels++;
  }
  assert(pixels>0,'A pixel comparison must inspect actual pixels');
  return {pixels,meanAbsoluteChannelDifference:total/(pixels*3),maximumChannelDifference:maximum,fractionPixelsOver3:overThree/pixels};
}
function samplingEnvelope(original,raster,{bounds,radius=1}={}){
  const width=original.info.width,height=original.info.height;
  let outsidePixels=0,maxOutside=0,flatPixels=0,flatMismatch=0;
  const left=bounds?Math.ceil(bounds.x):0,top=bounds?Math.ceil(bounds.y):0,right=bounds?Math.floor(bounds.x+bounds.w):width,bottom=bounds?Math.floor(bounds.y+bounds.h):height;
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    let outside=false,flat=true;
    for(let c=0;c<3;c++){
      let low=255,high=0;
      for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
        const i=(Math.max(0,Math.min(height-1,y+dy))*width+Math.max(0,Math.min(width-1,x+dx)))*3+c;
        low=Math.min(low,original.data[i]);high=Math.max(high,original.data[i]);
      }
      const value=raster.data[(y*width+x)*3+c],distance=Math.max(0,low-value,value-high);
      maxOutside=Math.max(maxOutside,distance);outside||=distance>1;flat&&=low===high;
    }
    outsidePixels+=outside?1:0;if(flat){flatPixels++;flatMismatch+=outside?1:0;}
  }
  return{outsidePixels,maxOutside,flatPixels,flatMismatch};
}

export async function verifyBoardArtifacts({ png, pdf, scene, logo, logoReference, dpi=300 }) {
  const checks=[],record=(name,detail={})=>checks.push({name,passed:true,...detail});
  const decoded=await decode(png),pngMeta=await sharp(png).metadata();
  assert.equal(pngMeta.format,'png','PNG file decodes as PNG');
  assert.equal(decoded.info.width,scene.size.width);assert.equal(decoded.info.height,scene.size.height);
  assert.equal(scene.size.width,2400);assert.equal(scene.size.height,1800);
  record('actual PNG decodes at the promised 2400 × 1800 pixels',{width:decoded.info.width,height:decoded.info.height});
  const sx=decoded.info.width/scene.size.width,sy=decoded.info.height/scene.size.height;
  for (const role of ['primary','secondary','accent','paper','ink']) {
    const node=scene.nodes.find(n=>n.id===`palette-${role}`);
    assert(node && node.type==='rect',`Palette ${role} is present`);
    const expected=hex(node.fill);assert(expected,`${role} uses a resolved sRGB hex fill`);
    const {x,y,w,h}=node.bounds;
    // A patch away from antialiased edges and printed labels, not a whole-image average.
    for(const fx of [.35,.5,.65])for(const fy of [.35,.5,.65]){
      const actual=rgbAt(decoded,(x+w*fx)*sx,(y+h*fy)*sy);
      assert(actual.every((n,i)=>Math.abs(n-expected[i])<=2),`${role} PNG pixels match declared color; got ${actual}, expected ${expected}`);
    }
  }
  record('five flat palette interiors match declared sRGB values');
  if(logo){
    const original=await sharp(logo).metadata(),nodes=scene.nodes.filter(n=>n.type==='image'&&n.sourceRole==='logo');
    const browserReference=logoReference?await decode(logoReference):null;
    assert(nodes.length,'Logo nodes exist');
    let sampled=0;const comparisons=[];
    const originalBytes=await readFile(logo),mime=original.format==='png'?'image/png':original.format==='webp'?'image/webp':'image/jpeg';
    for(const node of nodes){
      assert.equal(node.fit,'contain');assert.equal(node.preserveOriginal,true);
      assert(!node.filter&&!node.mask&&!node.clip&&!node.crop,'Logo cannot be filtered or cropped');
      const {x,y,w,h}=node.bounds,scale=Math.min(w/original.width,h/original.height);
      const width=Math.max(1,Math.round(original.width*scale*sx)),height=Math.max(1,Math.round(original.height*scale*sy));
      const left=Math.round((x+(w-original.width*scale)/2)*sx),top=Math.round((y+(h-original.height*scale)/2)*sy);
      const source=await sharp(logo).toColourspace('srgb').ensureAlpha().resize(width,height,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
      const alpha=(px,py)=>source.data[(py*width+px)*4+3];
      const background=rgbAt(source,0,0);let errors=0,total=0;
      for(let py=2;py<height-2;py++)for(let px=2;px<width-2;px++){
        if(alpha(px,py)<254)continue;
        const expected=rgbAt(source,px,py);
        if(!original.hasAlpha&&expected.every((n,i)=>Math.abs(n-background[i])<12))continue;
        // Compare solid original-color interiors; browser edge resampling is allowed.
        if([[-2,0],[2,0],[0,-2],[0,2]].some(([dx,dy])=>alpha(px+dx,py+dy)<254||rgbAt(source,px+dx,py+dy).some((n,i)=>Math.abs(n-expected[i])>2)))continue;
        const actual=rgbAt(decoded,left+px,top+py);total++;
        if(actual.some((n,i)=>Math.abs(n-expected[i])>4))errors++;
      }
      if(total>30)assert(errors/total<.005,`Logo ${node.id} changed color/geometry or was obscured (${errors}/${total} interior pixels differ)`);
      // Thin wordmarks and small application logos may have no solid interiors.
      // Compare them to an independent one-image reference composition instead.
      const prior=scene.nodes.slice(0,scene.nodes.indexOf(node));
      const backdrop=prior.filter(n=>n.type==='rect'&&hex(n.fill)&&n.bounds.x<=x&&n.bounds.y<=y&&n.bounds.x+n.bounds.w>=x+w&&n.bounds.y+n.bounds.h>=y+h).at(-1);
      assert(backdrop,`Logo ${node.id} has an explicit flat backdrop`);
      if(browserReference){
        // This optional reference must be composed independently from the exact
        // original bytes and unfiltered contain geometry in the same browser.
        // Every pixel in each logo node is compared, including its blank margins.
        const browserDiff=diff(decoded,browserReference,(px,py)=>px>=x&&px<x+w&&py>=y&&py<y+h);
        assert.equal(browserDiff.maximumChannelDifference,0,`Logo ${node.id} differs from the independent same-browser original reference: ${JSON.stringify(browserDiff)}`);
        comparisons.push({id:node.id,solidPixels:total,solidDifferences:errors,...browserDiff,exactSameBrowserReference:true});
        sampled+=total;
        continue;
      }
      const escaped=originalBytes.toString('base64'),referenceSVG=`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1800"><rect width="2400" height="1800" fill="${backdrop.fill}"/><image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="data:${mime};base64,${escaped}"/></svg>`;
      const reference=await sharp(Buffer.from(referenceSVG)).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true}),bg=hex(backdrop.fill);
      const foregroundDiff=diff(decoded,reference,(px,py)=>px>=x&&px<x+w&&py>=y&&py<y+h&&rgbAt(reference,px,py).some((n,i)=>Math.abs(n-bg[i])>8));
      // Chrome and librsvg use different image resampling kernels. Require
      // unchanged solid source colors above and a bounded 2px local envelope,
      // rather than weakening a whole-image average that could hide a changed logo.
      const envelope=samplingEnvelope(reference,decoded,{bounds:node.bounds,radius:2});
      assert.equal(envelope.outsidePixels,0,`Logo ${node.id} differs beyond its original local edge colors: ${JSON.stringify(envelope)}`);
      comparisons.push({id:node.id,solidPixels:total,solidDifferences:errors,...foregroundDiff,...envelope,edgeSamplingRadius:2});
      sampled+=total;
    }
    record('logo contained geometry and original colors survive composition',{nodes:nodes.length,sampledPixels:sampled,comparisons});
  }
  const temp=await mkdtemp(path.join(tmpdir(),'slaply-board-qa-'));
  try{
    const pdfDocument=await PDFDocument.load(await readFile(pdf));
    const embedded=pdfDocument.context.enumerateIndirectObjects().map(([,obj])=>obj).filter(obj=>obj instanceof PDFRawStream&&obj.dict.get(PDFName.of('Subtype'))?.toString()==='/Image'&&obj.dict.get(PDFName.of('ColorSpace'))?.toString().includes('/ICCBased'));
    assert.equal(embedded.length,1,'PDF embeds one sRGB board image');
    const originalPixels=Buffer.from(decodePDFRawStream(embedded[0]).decode());
    assert(originalPixels.equals(decoded.data),'Every embedded PDF RGB byte exactly matches decoded PNG pixels');
    record('PDF embeds the exact PNG RGB pixels losslessly',{bytes:originalPixels.length});
    const info=(await run(process.env.QA_PDFINFO||'pdfinfo',[pdf])).stdout;
    assert.match(info,/Pages:\s+1\b/,'PDF has exactly one page');
    const size=/Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(info);assert(size,'PDF reports page size');
    assert(Math.abs(Number(size[1])-576)<.05&&Math.abs(Number(size[2])-432)<.05,'PDF physical size is 576 × 432 pt');
    record('PDF has one page at 8 × 6 inches');
    const prefix=path.join(temp,'page');
    await run(process.env.QA_PDFTOPPM||'pdftoppm',['-singlefile','-r',String(dpi),'-png',pdf,prefix],{maxBuffer:1024*1024});
    const raster=await decode(`${prefix}.png`),difference=diff(decoded,raster);
    // Poppler samples the image between source pixels even at matching dpi.
    // Do not call those raster bytes exact: require exact embedded RGB above,
    // unchanged flat interiors, and every raster pixel within its local 1px
    // source-color envelope. This catches color changes and geometric shifts.
    const envelope=samplingEnvelope(decoded,raster);
    assert.equal(envelope.flatMismatch,0,'PDF raster preserves every flat source-color interior');
    assert.equal(envelope.outsidePixels,0,`PDF raster differs beyond one-pixel sampling: ${JSON.stringify(envelope)}`);
    record('PDF raster differences are bounded to local edge sampling',{...difference,...envelope,exactRasterBytes:decoded.data.equals(raster.data)});
  }finally{await rm(temp,{recursive:true,force:true});}
  return {checkedAt:new Date().toISOString(),checks,browserFontReview:'Not established by this file checker. Inspect the actual browser export and glyph layout separately.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const png=arg('png'),pdf=arg('pdf'),scenePath=arg('scene');
  assert(png&&pdf&&scenePath,'Usage: node evals/verify-board-artifacts.mjs --png board.png --pdf board.pdf --scene scene.json [--logo original.png] [--logo-reference independent-browser-reference.png] [--out report.json]');
  assert(!arg('logo-reference')||arg('logo'),'A browser reference also requires the original logo');
  const report=await verifyBoardArtifacts({png,pdf,scene:JSON.parse(await readFile(scenePath,'utf8')),logo:arg('logo'),logoReference:arg('logo-reference')});
  if(arg('out'))await writeFile(arg('out'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
