import { prepareLockedIngredients } from './prepare-locked-ingredients.js';

// Preparation belongs to one explicit Shake. Stale work must not publish or
// clear the busy state of a newer Shake, even if an upload cannot be aborted.
export function createGenerationPreparation({ prepare = prepareLockedIngredients, onBusyChange = () => {} } = {}) {
  let revision = 0;
  let active = null;
  const isCurrent = token => active === token;
  return {
    get active() { return active !== null; },
    invalidate() {
      if (active === null) return;
      active = null;
      onBusyChange(false);
    },
    dispose() { active = null; },
    async run(ingredients, { onPrepared = () => {}, onError = () => {} } = {}) {
      if (active !== null) return false;
      const token = ++revision;
      active = token;
      onBusyChange(true);
      try {
        const prepared = await prepare(ingredients, { isCurrent: () => isCurrent(token) });
        if (!prepared || !isCurrent(token)) return false;
        onPrepared(prepared);
        return true;
      } catch (error) {
        if (isCurrent(token)) onError(error);
        return false;
      } finally {
        if (isCurrent(token)) {
          active = null;
          onBusyChange(false);
        }
      }
    },
  };
}
