import { BRAND_OBJECT_IDS, objectCrop } from '../shared/brand-objects.mjs';
import { safeGuidelineImage } from './brand-guideline-model.js';

export function brandObjects(recipe={}) {
  const source=safeGuidelineImage(recipe.generatedImage);
  if(!source||!Array.isArray(recipe.brandObjects)||recipe.brandObjects.length!==3)return [];
  const objects=BRAND_OBJECT_IDS.map(id=>recipe.brandObjects.find(item=>item?.id===id));
  if(objects.some(item=>!item||typeof item.name!=='string'||typeof item.rationale!=='string'))return [];
  // Reconstruct immutable sheet geometry; saved/user text never supplies URLs,
  // crop coordinates or an arbitrary asset that could replace the original logo.
  return objects.map(item=>({...item,src:source,crop:objectCrop(item.id)}));
}
