import { normalizeCustomization } from './brand-guideline-model.js';
import { apiRequest, normalizeRecipe } from './api.js';

const text = value => String(value ?? '').trim();

// Saved IDs/version timestamps differ from the working job. Compare only the
// source job and fields the server actually persists as user edits.
export function recipeFingerprint(recipe) {
  if (!recipe?.id && !recipe?.jobId) return '';
  return JSON.stringify({
    jobId: recipe.jobId || recipe.id,
    name: text(recipe.name),
    words: text(recipe.words),
    concept: { title: text(recipe.concept?.title), summary: text(recipe.concept?.summary) },
    customization: normalizeCustomization(recipe.customization),
  });
}

export function isRecipeSaved(recipe, savedRecipes = []) {
  const fingerprint = recipeFingerprint(recipe);
  return Boolean(fingerprint && savedRecipes.some(saved => !saved.trashedAt && recipeFingerprint(saved) === fingerprint));
}

export function upsertRecipe(recipes, recipe) {
  return [recipe, ...recipes.filter(item => item.id !== recipe.id)];
}

export async function persistRecipeSnapshot(recipe, request = apiRequest) {
  const snapshot = structuredClone(recipe);
  const result = await request('/api/recipes', { method: 'POST', body: JSON.stringify({ recipe: snapshot }) });
  if (!result.recipe?.id) throw new Error('ยังยืนยันการเก็บสูตรไม่ได้ กรุณาลองใหม่');
  return { persisted: true, recipe: normalizeRecipe(result.recipe), fingerprint: recipeFingerprint(snapshot) };
}

export async function moveSavedRecipe(id, restore = false, request = apiRequest) {
  const result = await request(`/api/recipes/${encodeURIComponent(id)}${restore ? '/restore' : ''}`, {
    method: restore ? 'POST' : 'DELETE', ...(restore ? { body: '{}' } : {}),
  });
  if (!result.recipe?.id || result.recipe.id !== id || (restore ? !result.restored : !result.trashed)) {
    throw new Error('ยังยืนยันสถานะสูตรไม่ได้ กรุณาเปิดรายการอีกครั้ง');
  }
  return normalizeRecipe(result.recipe);
}

export function applyRecipeMove(state, recipe, restore = false) {
  return restore
    ? { recipes: upsertRecipe(state.recipes, recipe), trash: state.trash.filter(item => item.id !== recipe.id) }
    : { recipes: state.recipes.filter(item => item.id !== recipe.id), trash: upsertRecipe(state.trash, recipe) };
}
