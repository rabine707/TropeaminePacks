/** Base and foil editions represent the same character in the Binder. */
export function hasCardEdition(owned: readonly string[], cardId: string): boolean {
  return owned.includes(cardId) || owned.includes(`${cardId}:foil`);
}

/** Showcase can use any owned card edition; a treatment alone is not a card. */
export function ownedCharacterIds(owned: readonly string[]): string[] {
  return [...new Set(owned
    .filter(id => id && (!id.includes(':') || /^[^:]+:foil$/.test(id)))
    .map(id => id.replace(/:foil$/, '')))];
}

export function matchesBinderStatus(status: string, cardId: string, owned: readonly string[], favorites: readonly string[]): boolean {
  switch (status) {
    case 'Collected': return hasCardEdition(owned, cardId);
    case 'Missing': return !hasCardEdition(owned, cardId);
    case 'Favorites': return favorites.includes(cardId);
    case 'Recently acquired': {
      const recent = owned.filter(id => !id.includes(':treatment:')).slice(-5);
      return hasCardEdition(recent, cardId);
    }
    default: return true;
  }
}

export function isFoilDisplay(owned: readonly string[], cardId: string, savedFinish: string, editionFilter = 'All editions'): boolean {
  if (editionFilter === 'Base editions') return false;
  if (editionFilter === 'Foil editions') return owned.includes(`${cardId}:foil`);
  return owned.includes(`${cardId}:foil`) && (savedFinish === 'foil' || !owned.includes(cardId));
}

export function matchesOwnedEdition(edition: string, cardId: string, owned: readonly string[]): boolean {
  if (edition === 'Base editions') return owned.includes(cardId);
  if (edition === 'Foil editions') return owned.includes(`${cardId}:foil`);
  return true;
}
