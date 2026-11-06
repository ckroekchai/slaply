#!/usr/bin/env node
// Read-only verification of real exported bytes. No browser or provider requests.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { logoRenderPlan, assertCutoutPixels, logoReferenceMarkup } from './board-logo-contract.mjs';

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

export async function verifyBoardArtifacts({ png, pdf, scene, logo, logoReference, logoOriginal, recipe, logoMetadata=recipe?.logo||{}, customization=recipe?.customization||{}, dpi=300 }) {
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
    const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
    if(logoMetadata.cutout===true){
      assert(logoOriginal,'A cutout verification also requires the preserved full-resolution original file');
      const originalFile=await readFile(logoOriginal);
      if(logoMetadata.sha256)assert.equal(digest(originalFile),logoMetadata.sha256,'Preserved source bytes match the saved original digest');
      if(logoMetadata.renderSha256)assert.equal(digest(originalBytes),logoMetadata.renderSha256,'Displayed cutout bytes match the saved derivative digest');
      const [sourcePixels,cutoutPixels]=await Promise.all([sharp(originalFile).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true}),sharp(originalBytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true})]);
      const evidence=assertCutoutPixels(sourcePixels,cutoutPixels);
      record('cutout retains full source resolution and foreground colors with a separate original',{...evidence,originalSha256:digest(originalFile),cutoutSha256:digest(originalBytes)});
    }
    for(const node of nodes){
      const plan=logoRenderPlan(node,logoMetadata,original,customization),sr=plan.sourceRect;
      const {x,y,w,h}=node.bounds,scale=Math.min(w/sr.width,h/sr.height);
      // Only the contained source rectangle is painted. A wide contain box
      // can cross panel gutters while its centered square identity does not.
      // Transparent margins inside the source are still part of this check.
      const paintedBounds={x:x+(w-sr.width*scale)/2,y:y+(h-sr.height*scale)/2,w:sr.width*scale,h:sr.height*scale};
      const width=Math.max(1,Math.round(sr.width*scale*sx)),height=Math.max(1,Math.round(sr.height*scale*sy));
      const left=Math.round((x+(w-sr.width*scale)/2)*sx),top=Math.round((y+(h-sr.height*scale)/2)*sy);
      const source=await sharp(logo).toColourspace('srgb').ensureAlpha().extract(sr).resize(width,height,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
      const alpha=(px,py)=>source.data[(py*width+px)*4+3];
      const background=rgbAt(source,0,0);let errors=0,total=0;
      for(let py=2;plan.mode!=='generated'&&py<height-2;py++)for(let px=2;px<width-2;px++){
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
      const backdrop=prior.filter(n=>n.type==='rect'&&hex(n.fill)&&n.bounds.x<=paintedBounds.x&&n.bounds.y<=paintedBounds.y&&n.bounds.x+n.bounds.w>=paintedBounds.x+paintedBounds.w&&n.bounds.y+n.bounds.h>=paintedBounds.y+paintedBounds.h).at(-1);
      assert(backdrop,`Logo ${node.id} has an explicit flat backdrop`);
      let clearGutterPixels=0;
      if(plan.crop){
        // The atlas-leak regression happens outside the contained source, so
        // inspect those gutters as well. Resolve their actual prior flat layer
        // rather than assuming a single panel also covers neighboring gutters.
        const layers=[...prior].reverse();
        const backgroundAt=(px,py)=>{
          for(const layer of layers){const b=layer.bounds;if(px<b.x||px>=b.x+b.w||py<b.y||py>=b.y+b.h)continue;
            if(layer.type!=='rect'||!hex(layer.fill))return null;
            const r=layer.radius||0;if(Math.min(px-b.x,b.x+b.w-px,py-b.y,b.y+b.h-py)<2)return null;
            if(r&&((px<b.x+r||px>b.x+b.w-r)&&(py<b.y+r||py>b.y+b.h-r)))return null;
            return hex(layer.fill);
          }return null;
        };
        for(let py=Math.ceil(y+1);py<Math.floor(y+h-1);py++)for(let px=Math.ceil(x+1);px<Math.floor(x+w-1);px++){
          if(px>=paintedBounds.x-2&&px<=paintedBounds.x+paintedBounds.w+2&&py>=paintedBounds.y-2&&py<=paintedBounds.y+paintedBounds.h+2)continue;
          const expected=backgroundAt(px,py);if(!expected)continue;
          const actual=rgbAt(decoded,px,py);clearGutterPixels++;
          assert(actual.every((n,i)=>Math.abs(n-expected[i])<=2),`Logo ${node.id} leaks image content into its unpainted contain gutter at ${px},${py}`);
        }
      }
      if(browserReference){
        // This optional reference must be independently composed from the exact
        // source bytes and authorized source crop/adjustments in the same browser.
        // Every pixel of the contained source is compared, including its
        // transparent margins, while unpainted contain-box gutters are excluded.
        const browserDiff=diff(decoded,browserReference,(px,py)=>px>=paintedBounds.x&&px<paintedBounds.x+paintedBounds.w&&py>=paintedBounds.y&&py<paintedBounds.y+paintedBounds.h);
        assert.equal(browserDiff.maximumChannelDifference,0,`Logo ${node.id} differs from the independent same-browser original reference: ${JSON.stringify(browserDiff)}`);
        comparisons.push({id:node.id,mode:plan.mode,sourceCrop:plan.crop,clearGutterPixels,solidPixels:total,solidDifferences:errors,...browserDiff,exactSameBrowserReference:true});
        sampled+=total;
        continue;
      }
      const escaped=originalBytes.toString('base64'),referenceSVG=`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1800"><rect width="2400" height="1800" fill="${backdrop.fill}"/>${logoReferenceMarkup(node,plan,`data:${mime};base64,${escaped}`)}</svg>`;
      const reference=await sharp(Buffer.from(referenceSVG)).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true}),bg=hex(backdrop.fill);
      const foregroundDiff=diff(decoded,reference,(px,py)=>px>=paintedBounds.x&&px<paintedBounds.x+paintedBounds.w&&py>=paintedBounds.y&&py<paintedBounds.y+paintedBounds.h&&rgbAt(reference,px,py).some((n,i)=>Math.abs(n-bg[i])>8));
      // Chrome and librsvg use different image resampling kernels. Require
      // unchanged solid source colors above and a bounded 2px local envelope,
      // rather than weakening a whole-image average that could hide a changed logo.
      const envelope=samplingEnvelope(reference,decoded,{bounds:paintedBounds,radius:2});
      assert.equal(envelope.outsidePixels,0,`Logo ${node.id} differs beyond its original local edge colors: ${JSON.stringify(envelope)}`);
      comparisons.push({id:node.id,mode:plan.mode,sourceCrop:plan.crop,clearGutterPixels,solidPixels:total,solidDifferences:errors,...foregroundDiff,...envelope,edgeSamplingRadius:2});
      sampled+=total;
    }
    record('logo composition matches its authorized source geometry and colors',{nodes:nodes.length,sampledPixels:sampled,comparisons});
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
  assert(png&&pdf&&scenePath,'Usage: node evals/verify-board-artifacts.mjs --png board.png --pdf board.pdf --scene scene.json [--logo displayed-source.png] [--recipe recipe.json] [--original-logo preserved-source.png] [--logo-reference independent-browser-reference.png] [--out report.json]');
  assert(!arg('logo-reference')||arg('logo'),'A browser reference also requires the original logo');
  const sourceRecipe=arg('recipe')?JSON.parse(await readFile(arg('recipe'),'utf8')):undefined;
  const report=await verifyBoardArtifacts({png,pdf,scene:JSON.parse(await readFile(scenePath,'utf8')),logo:arg('logo'),logoOriginal:arg('original-logo'),recipe:sourceRecipe?.recipe||sourceRecipe,logoReference:arg('logo-reference')});
  if(arg('out'))await writeFile(arg('out'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
