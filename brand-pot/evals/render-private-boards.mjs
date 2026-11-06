#!/usr/bin/env node
// Deterministic, local-only fixture rendering. Never uploads client artwork.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildBrandBoardScene, layoutBrandBoardText, renderBrandBoardSVG, BOARD_FONT_CATALOG } from '../src/brand-board-scene.js';
import { tagSRGBPNG, createBoardPDF } from '../src/export-formats.js';
import { chooseLogoBackdrop } from '../src/logo-backdrop.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>{const i=process.argv.indexOf(`--${name}`);return i<0?undefined:process.argv[i+1];};
const privateDir=path.resolve(root,'qa/private'),aiDir=arg('ai-results')?path.resolve(arg('ai-results')):null,out=path.join(privateDir,aiDir?'ai-render':'boards');
const manifest=JSON.parse(await readFile(arg('manifest')||path.join(privateDir,'brand-fixtures.json'),'utf8'));
const requested=arg('fixture')?.split(',').filter(Boolean),selected=requested?manifest.fixtures.filter(f=>requested.includes(f.id)):manifest.fixtures;
assert(selected.length&&(!requested||selected.length===new Set(requested).size),'Every requested fixture must exist in the private manifest');
await mkdir(out,{recursive:true});
const fontsDir=path.join(root,'public/assets/fonts'),fontconfig=path.join(privateDir,'fonts.conf');
await writeFile(fontconfig,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontsDir.replace(/&/g,'&amp;')}</dir><cachedir>${privateDir}/font-cache</cachedir><config></config></fontconfig>`);
process.env.FONTCONFIG_FILE=fontconfig;
const sharp=(await import(process.env.QA_SHARP_MODULE?pathToFileURL(process.env.QA_SHARP_MODULE).href:'sharp')).default;
const {createCanvas,GlobalFonts}=await import(process.env.QA_CANVAS_MODULE?pathToFileURL(process.env.QA_CANVAS_MODULE).href:'@napi-rs/canvas');
const {verifyBoardArtifacts}=await import('./verify-board-artifacts.mjs');
for(const font of BOARD_FONT_CATALOG){
  const fontPath=path.join(root,'public',font.src);await readFile(fontPath);
  assert(GlobalFonts.registerFromPath(fontPath,font.family),`Font ${font.family} registers from the repository file`);
}
const measureContext=createCanvas(1,1).getContext('2d');
const measureText=(text,node,size)=>{measureContext.font=`${node.fontWeight} ${size}px "${node.fontFamily}", "${node.fontFallback||'Noto Sans Thai'}", sans-serif`;measureContext.letterSpacing=`${node.letterSpacing||0}px`;return measureContext.measureText(text).width;};

const roles=['primary','secondary','accent','paper','ink'],runs=[];
for(const fixture of selected){
  const bytes=await readFile(fixture.localPath);assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.sha256,'Private original hash matches manifest');
  const direction=fixture.proposedDirection;assert(direction,'Known fixture has an explicit proposed test brief');
  const src=`/api/assets/qa_${fixture.id.replaceAll('-','_')}`,mime=fixture.format==='png'?'image/png':'image/jpeg',data=`data:${mime};base64,${bytes.toString('base64')}`;
  const sample=await sharp(bytes).ensureAlpha().resize(256,256,{fit:'inside',withoutEnlargement:true}).raw().toBuffer({resolveWithObject:true}),autoBackdrop=chooseLogoBackdrop(sample.data,{width:sample.info.width,height:sample.info.height});
  const rawRecipePath=aiDir?path.join(aiDir,`${fixture.id}.recipe.json`):null,rawRecipeBytes=rawRecipePath?await readFile(rawRecipePath):null,actualRecipe=rawRecipeBytes?JSON.parse(rawRecipeBytes):null;
  if(actualRecipe){assert.equal(actualRecipe.logo.sha256,fixture.sha256,'Actual AI recipe refers to the exact original fixture');assert.equal(actualRecipe.name,direction.name,'Actual AI preserves the supplied brand name');}
  for(const template of ['ai','minimal','professional','creative']){
    const fontPair='editorial-serif',id=`${fixture.id}-${template}`;
    const recipe=actualRecipe?structuredClone(actualRecipe):{schemaVersion:6,name:direction.name,words:direction.words,concept:direction.concept,logo:{assetId:`qa_${fixture.id}`,src,width:fixture.width,height:fixture.height,sha256:fixture.sha256,mime,preserveOriginal:true},ingredients:[{id:`qa_${fixture.id}`,src,role:'logo',locked:true}],design:{template:'editorial',fontPair,imageStyle:'graphic',density:'balanced'},brandSystem:{palette:roles.map((role,i)=>({role,hex:direction.palette[i],name:role})),typography:{headingSample:direction.heading,bodySample:direction.body},pattern:{kind:'stripe'},applications:[{kind:'social',headline:direction.heading,body:direction.body},{kind:'business-card',headline:direction.name,body:'Brand direction / แนวทางทดลอง'}]},customization:{logoBackdrop:'auto',objectStyles:[]}};
    const uiOverrides=[];
    recipe.customization={...recipe.customization,boardVariant:template};
    if(actualRecipe&&recipe.customization?.logoBackdrop!=='auto'){uiOverrides.push({field:'customization.logoBackdrop',from:recipe.customization?.logoBackdrop,to:'auto',reason:'Use current UI default; AI design/palette/copy remain unchanged.'});recipe.customization={...recipe.customization,logoBackdrop:'auto'};}
    const assets=new Map([[recipe.logo.src,data]]);let generatedSha256,displayedLogo=fixture.localPath;
    if(actualRecipe){
      const downloadedOriginal=await readFile(path.join(aiDir,`${fixture.id}-original.${fixture.format==='png'?'png':'jpg'}`));assert.equal(createHash('sha256').update(downloadedOriginal).digest('hex'),fixture.sha256,'Downloaded provider-run original remains byte exact');
      const generated=await readFile(path.join(aiDir,`${fixture.id}-generated.png`));generatedSha256=createHash('sha256').update(generated).digest('hex');assets.set(recipe.generatedImage,`data:image/png;base64,${generated.toString('base64')}`);
      if(recipe.logo.generated)displayedLogo=path.join(aiDir,`${fixture.id}-generated.png`);
      else if(recipe.logo.cutout){displayedLogo=path.join(aiDir,`${fixture.id}-cutout.png`);const cutout=await readFile(displayedLogo);assets.set(recipe.logo.src,`data:image/png;base64,${cutout.toString('base64')}`);}
    }
    const scene=layoutBrandBoardText(buildBrandBoardScene(recipe,{}, {logoBackdrop:autoBackdrop}),measureText),svg=renderBrandBoardSVG(scene,{resolveAsset:value=>assets.get(value)||value});
    // The native SVG-to-path helper drops embedded image nodes and mishandles
    // mixed-script fallbacks. Keep original image/shape SVG intact; paint text
    // with the registered Canvas fonts at the scene's measured line positions.
    const withoutText=svg.replace(/<text\b[\s\S]*?<\/text>/g,''),textCanvas=createCanvas(2400,1800),textContext=textCanvas.getContext('2d');
    for(const node of scene.nodes.filter(n=>n.type==='text')){
      textContext.font=`${node.fontWeight} ${node.computedFontSize}px "${node.fontFamily}", "${node.fontFallback||'Noto Sans Thai'}", sans-serif`;
      textContext.fillStyle=node.fill;textContext.letterSpacing=`${node.letterSpacing||0}px`;textContext.textBaseline='alphabetic';textContext.textAlign=node.align==='center'?'center':node.align==='right'?'right':'left';
      for(const line of node.lines)textContext.fillText(line.text,line.x,line.y);
    }
    const png=tagSRGBPNG(await sharp(Buffer.from(withoutText)).composite([{input:await textCanvas.encode('png')}]).png().toBuffer(),{dpi:300}),pdf=await createBoardPDF(png,{width:2400,height:1800,title:direction.name,dpi:300});
    const stem=path.join(out,id),files={png:`${stem}.png`,pdf:`${stem}.pdf`,scene:`${stem}.scene.json`,recipe:`${stem}.recipe.json`};
    await Promise.all([writeFile(files.png,png),writeFile(files.pdf,pdf),writeFile(files.scene,JSON.stringify(scene,null,2)),writeFile(files.recipe,JSON.stringify(recipe,null,2))]);
    let verification;
    try{verification=await verifyBoardArtifacts({png:files.png,pdf:files.pdf,scene,recipe,logo:displayedLogo,logoOriginal:recipe.logo.cutout?fixture.localPath:undefined});}catch(error){verification={passed:false,error:error.message};}
    if(rawRecipeBytes)assert(Buffer.from(await readFile(rawRecipePath)).equals(rawRecipeBytes),'Raw AI recipe remains unchanged');
    runs.push({id,fixtureId:fixture.id,provenance:actualRecipe?'actual-provider-result':'manually-selected-deterministic-fixture',sourceHash:fixture.sha256,rawRecipeSha256:rawRecipeBytes?createHash('sha256').update(rawRecipeBytes).digest('hex'):undefined,generatedSha256,template:scene.templateId,fontPair:scene.fontPairId,autoBackdrop,uiOverrides,ai:actualRecipe?{jobId:actualRecipe.jobId,textModel:actualRecipe.ai?.textModel,imageModel:actualRecipe.ai?.imageModel,promptVersion:actualRecipe.ai?.promptVersion}:undefined,files,verification});
    console.log(`${verification.passed===false?'FAIL':'PASS'} ${id}${verification.error?`: ${verification.error}`:''}`);
  }
}
const report={createdAt:new Date().toISOString(),mode:actualMode(),renderer:'Local native Canvas text with explicitly registered repository fonts, composited over sharp/librsvg shape/image rasterization at the shared scene coordinates; no paid AI or browser automation',scope:'Deterministic format, geometry and original-source QA. Briefs are proposed test directions, not real brand business facts. Browser font/render verification remains separate; this adapter is not the production browser exporter.',runs};
if(requested){
  let previous;try{previous=JSON.parse(await readFile(path.join(out,'report.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  report.rerenderedFixtureIds=requested;
  report.runs=[...(previous?.runs||[]).filter(run=>!requested.includes(run.fixtureId)),...runs];
}
await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
process.exitCode=runs.some(run=>run.verification.passed===false)?1:0;
function actualMode(){return aiDir?'actual-provider-results':'manual-template-matrix';}
