// Independent export-check contract. This deliberately does not import the
// production scene builder: saved source metadata must authorize any crop.
import assert from 'node:assert/strict';

const validBounds=value=>value&&['x','y','w','h'].every(key=>Number.isFinite(value[key]))&&value.x>=0&&value.y>=0&&value.w>0&&value.h>0&&value.x+value.w<=1.00001&&value.y+value.h<=1.00001;
const bounded=(value,min,max,fallback)=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;

export function logoRenderPlan(node, metadata={}, source={}, customization={}) {
  assert.equal(node.fit,'contain','Every logo uses contain geometry');
  assert(!node.filter&&!node.mask&&!node.clip&&!node.crop,'Unreviewed image effects cannot alter logo geometry');
  const mode=metadata.generated===true?'generated':metadata.cutout===true?'cutout':'original';
  let crop=null;
  if(mode==='generated'){
    assert.deepEqual(metadata.crop,{x:.5,y:.5,w:.5,h:.5},'A generated identity occupies only the reserved fourth atlas cell');
    crop=metadata.crop;assert.equal(node.preserveOriginal,false);
    assert.equal(source.width,source.height,'Generated identity atlas is square');
  }else{
    assert.equal(node.preserveOriginal,true,'Original source identity is explicitly preserved');
    assert(!node.adjustment,'Locked and legacy originals cannot inherit color adjustments');
    if(mode==='cutout'){
      assert(validBounds(metadata.contentBounds),'Cutout has explicitly authorized normalized content bounds');
      crop=metadata.contentBounds;
    }
  }
  if(crop){
    assert.deepEqual(node.sourceCrop,crop,'Rendered crop matches saved source metadata');
    assert.equal(node.allowSourceCrop,true,'Authorized crop is explicit');
    assert.equal(node.cropWidth,mode==='generated'?1024:source.width);
    assert.equal(node.cropHeight,mode==='generated'?1024:source.height);
  }else assert(!node.sourceCrop&&!node.allowSourceCrop,'An ordinary original cannot silently acquire a crop');
  const adjustment=mode==='generated'?{hue:bounded(customization.hue,-180,180,0),saturation:bounded(customization.saturation,0,180,100),brightness:bounded(customization.brightness,50,150,100)}:null;
  if(adjustment)assert.deepEqual(node.adjustment,adjustment,'Generated identity colors match the saved customization');
  const sourceRect=crop?{left:Math.round(crop.x*source.width),top:Math.round(crop.y*source.height),width:Math.round(crop.w*source.width),height:Math.round(crop.h*source.height)}:{left:0,top:0,width:source.width,height:source.height};
  assert(sourceRect.width>0&&sourceRect.height>0,'Authorized crop includes actual source pixels');
  return {mode,crop,sourceRect,adjustment};
}

export function assertCutoutPixels(original,cutout) {
  assert.equal(original.info.width,cutout.info.width,'Cutout retains the complete original canvas width');
  assert.equal(original.info.height,cutout.info.height,'Cutout retains the complete original canvas height');
  assert.equal(original.info.channels,4);assert.equal(cutout.info.channels,4);
  let visiblePixels=0,opaquePixels=0,alphaChanges=0;
  for(let p=0;p<cutout.data.length;p+=4){
    const alpha=cutout.data[p+3],sourceAlpha=original.data[p+3];
    assert(alpha<=sourceAlpha,'Cutout can only remove alpha, never invent foreground pixels');
    if(alpha!==sourceAlpha)alphaChanges++;
    if(!alpha)continue;
    visiblePixels++;if(alpha===255)opaquePixels++;
    // Canvas PNG round-trips can unpremultiply partially transparent edges.
    // At opacity255 source RGB must be exact; lower alpha permits only the
    // mathematically bounded one-step premultiplication rounding error.
    const tolerance=alpha===255?0:Math.ceil(255/alpha);
    for(let channel=0;channel<3;channel++)assert(Math.abs(cutout.data[p+channel]-original.data[p+channel])<=tolerance,'Cutout foreground retains source RGB values');
  }
  assert(visiblePixels>0,'Cutout retains visible source content');
  return {width:original.info.width,height:original.info.height,visiblePixels,opaquePixels,alphaChanges};
}

export function logoReferenceMarkup(node,plan,sourceData) {
  const {x,y,w,h}=node.bounds,a=plan.adjustment;
  const filtered=a&&(a.hue!==0||a.saturation!==100||a.brightness!==100);
  const filter=filtered?`<defs><filter id="reference-color" color-interpolation-filters="sRGB"><feColorMatrix type="hueRotate" values="${a.hue}"/><feColorMatrix type="saturate" values="${a.saturation/100}"/><feComponentTransfer><feFuncR type="linear" slope="${a.brightness/100}"/><feFuncG type="linear" slope="${a.brightness/100}"/><feFuncB type="linear" slope="${a.brightness/100}"/></feComponentTransfer></filter></defs>`:'';
  const imageFilter=filtered?' filter="url(#reference-color)"':'';
  if(plan.crop){
    const c=plan.crop,cw=node.cropWidth,ch=node.cropHeight,aspect=(c.w*cw)/(c.h*ch),width=Math.min(w,h*aspect),height=width/aspect;
    // The independently composed crop viewport must not include letterbox
    // gutters: those would reveal other atlas cells outside the chosen viewBox.
    return `${filter}<svg x="${x+(w-width)/2}" y="${y+(h-height)/2}" width="${width}" height="${height}" viewBox="${c.x*cw} ${c.y*ch} ${c.w*cw} ${c.h*ch}" overflow="hidden" preserveAspectRatio="xMidYMid meet"><image x="0" y="0" width="${cw}" height="${ch}" href="${sourceData}"${imageFilter}/></svg>`;
  }
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${sourceData}"/>`;
}
