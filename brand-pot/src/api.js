export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin', ...options,
    headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('ระบบตอบกลับไม่สมบูรณ์ กรุณาลองใหม่'); }
  if (!response.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : data.error?.message || data.message || `เชื่อมต่อระบบไม่ได้ (${response.status})`);
    error.code = data.error?.code || data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function normalizeRecipe(recipe = {}) {
  const ingredients = Array.from({ length: 6 }, (_, index) => {
    const item = recipe.ingredients?.[index];
    return item ? { ...item, src: item.src || item.url || '', name: item.name || `วัตถุดิบ ${index + 1}`, locked: Boolean(item.locked) } : null;
  });
  return { ...recipe, ingredients, productImage: recipe.productImage || ingredients.find(Boolean)?.src || '', referenceImage: recipe.referenceImage || ingredients.filter(Boolean)[1]?.src || '', image: recipe.image || recipe.productImage || ingredients.find(Boolean)?.src || '', mood: recipe.mood || 'fresh', name: recipe.name || '', words: recipe.words || '', format: 'guideline' };
}

// Publish one complete hydration snapshot. Exposing session readiness before the
// recipe request finishes can reveal an incomplete input table during restoration.
export async function loadKitchenSession(request = apiRequest, storedJobId = null) {
  const session = await request('/api/session');
  const saved = await request('/api/recipes');
  return {
    session,
    recipes: (saved.recipes || []).map(normalizeRecipe),
    activeJobId: session.activeJob?.id || storedJobId,
    latestRecipe: session.latestRecipe ? normalizeRecipe(session.latestRecipe) : null,
  };
}
