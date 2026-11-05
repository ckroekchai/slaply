export const INGREDIENT_ROLES = Object.freeze([
  { id: 'logo', label: 'โลโก้ต้นฉบับ' },
  { id: 'product', label: 'สินค้า' },
  { id: 'reference', label: 'ภาพแรงบันดาลใจ' },
]);
export function canCookIngredients(ingredients, brief = {}) {
  const selected = ingredients.filter(Boolean);
  return selected.length >= 2 || (selected.length === 1 && selected[0].role === 'logo' && Boolean(String(brief.words || '').trim()));
}
export function assignIngredientRole(ingredients, index, role) {
  if (!INGREDIENT_ROLES.some(item => item.id === role) || !ingredients[index]) return ingredients;
  return ingredients.map((item, i) => !item ? item : i === index ? { ...item, role } : role === 'logo' && item.role === 'logo' ? { ...item, role: 'reference' } : item);
}
export function uploadIngredientRole(ingredients, index) {
  return ingredients[index]?.role || (index === 0 && !ingredients.some(item => item?.role === 'logo') ? 'logo' : 'reference');
}
