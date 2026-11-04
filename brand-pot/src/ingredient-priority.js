export function prioritizeIngredients(ingredients) {
  const valid = ingredients.filter(Boolean);
  const primary = valid.find(item => item.locked) || valid[0];
  const refs = valid.filter(item => item !== primary);
  // Image selection and palette influence are separate: promoting a locked image
  // must not accidentally remove its color from the recipe.
  const weighted = valid.map(item => ({ rgb: item.rgb || [200,220,200], weight: item.locked ? 3 : 1 }));
  const total = weighted.reduce((sum,item) => sum + item.weight,0) || 1;
  const rgb = [0,1,2].map(channel => Math.round(weighted.reduce((sum,item) => sum + item.rgb[channel] * item.weight,0) / total));
  return { valid, primary, reference: refs[0] || primary, rgb };
}
