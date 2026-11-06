export const INGREDIENT_ROLES = Object.freeze([
  { id: 'logo', label: 'โลโก้ต้นฉบับ' },
  { id: 'product', label: 'สินค้า' },
  { id: 'reference', label: 'ภาพแรงบันดาลใจ' },
]);
export const MIN_INGREDIENTS = 3;
export function canCookIngredients(ingredients) {
  const selected = ingredients.filter(Boolean);
  return selected.length >= MIN_INGREDIENTS && selected.length <= 6;
}
export function ingredientSlotLabel(index) { return index < 2 ? 'วัตถุดิบหลัก' : 'ปรุงรส'; }
export function recipeBrief(recipe = {}) {
  return { ...recipe.brief, name: recipe.name || recipe.brief?.name || '', words: recipe.words || recipe.brief?.words || '', chefNotes: recipe.brief?.chefNotes || '' };
}
export function assignIngredientRole(ingredients, index, role) {
  if (!INGREDIENT_ROLES.some(item => item.id === role) || !ingredients[index]) return ingredients;
  return ingredients.map((item, i) => !item ? item : i === index ? { ...item, role } : role === 'logo' && item.role === 'logo' ? { ...item, role: 'reference' } : item);
}
// New ingredients are classified by AI, never by the upload slot.
export function uploadIngredientRole() { return 'reference'; }
