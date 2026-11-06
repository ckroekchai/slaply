// Conservative, local matte removal. Only background-connected alpha changes;
// the source RGB values and canvas dimensions are never rewritten or reduced.
export function cutoutLockedPixels(pixels, width, height) {
  if (!(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || pixels.length !== width * height * 4) throw new Error('Invalid original image pixels');
  const count = width * height;
  const unchanged = reason => ({ pixels, width, height, status: 'unchanged', reason, bounds: { x: 0, y: 0, w: 1, h: 1 } });
  if (count > 16_000_000) return unchanged('large-image');
  function boundsFor(data) {
    let left=width, top=height, right=-1, bottom=-1, visible=0;
    for (let p=0;p<count;p++) if(data[p*4+3]>16) { const x=p%width,y=Math.floor(p/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);visible++; }
    if(!visible)return null;
    const padding=Math.max(2,Math.ceil(Math.max(right-left+1,bottom-top+1)*.035));
    left=Math.max(0,left-padding);top=Math.max(0,top-padding);right=Math.min(width-1,right+padding);bottom=Math.min(height-1,bottom+padding);
    return { bounds:{x:left/width,y:top/height,w:(right-left+1)/width,h:(bottom-top+1)/height},visible };
  }
  let transparent=0;
  for(let p=0;p<count;p++)if(pixels[p*4+3]<250)transparent++;
  if(transparent/count>.005){const original=boundsFor(pixels);return original?{pixels,width,height,status:'transparent',bounds:original.bounds}:unchanged('empty-image');}

  const edge=[];
  const stride=Math.max(1,Math.floor(Math.max(width,height)/256));
  for(let x=0;x<width;x+=stride){edge.push(x,(height-1)*width+x);}
  for(let y=0;y<height;y+=stride){edge.push(y*width,y*width+width-1);}
  const channels=[0,1,2].map(c=>edge.map(p=>pixels[p*4+c]).sort((a,b)=>a-b));
  const background=channels.map(values=>values[Math.floor(values.length/2)]);
  const distance=p=>Math.max(...background.map((v,c)=>Math.abs(pixels[p*4+c]-v)));
  // Photos and artwork with content along the edge do not have a reliable
  // flat matte. Preserve these rather than cutting a customer's subject away.
  if(edge.filter(p=>distance(p)<=14).length/edge.length<.97)return unchanged('complex-background');
  const visited=new Uint8Array(count),queue=new Uint32Array(count);let start=0,end=0;
  function add(p){if(!visited[p]&&distance(p)<=28){visited[p]=1;queue[end++]=p;}}
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
  for(let y=1;y<height-1;y++){add(y*width);add(y*width+width-1);}
  while(start<end){const p=queue[start++],x=p%width;if(x>0)add(p-1);if(x<width-1)add(p+1);if(p>=width)add(p-width);if(p<count-width)add(p+width);}
  if(end/count<.03||end/count>.985)return unchanged(end/count>.985?'no-distinct-subject':'no-border-matte');
  const output=new Uint8ClampedArray(pixels);
  for(let i=0;i<end;i++) { const p=queue[i],d=distance(p);output[p*4+3]=d<=12?0:Math.round(pixels[p*4+3]*(d-12)/16); }
  const content=boundsFor(output);
  if(!content||content.visible/count<.005)return unchanged('no-distinct-subject');
  return {pixels:output,width,height,status:'removed',bounds:content.bounds,background,removedPixels:end};
}
