/**
 * Client-side port of server/gameLogic.js helpers needed for UI previews.
 */

/**
 * Generates the round card-count sequence — mirrors server generateRoundSequence.
 * Returns an array of { cardsPerPlayer, noTrump }.
 */
export function generateRoundSequence(numPlayers, peakCards = null, noTrumpRounds = 0, minCards = 3) {
  if (!numPlayers || numPlayers < 2) return [];

  const resolvedPeak = peakCards ?? Math.floor(52 / numPlayers);

  if (resolvedPeak < minCards) return [];

  const ascending = [];
  for (let c = minCards; c <= resolvedPeak; c++) ascending.push(c);
  const descending = ascending.slice(0, -1).reverse();
  let sequence = [...ascending, ...descending];

  while (sequence.length % numPlayers !== 0) {
    const last = sequence[sequence.length - 1];
    sequence.push(last + 1 <= resolvedPeak ? last + 1 : minCards);
  }

  const midIndex = Math.floor((sequence.length - 1) / 2);
  const noTrumpIndices = new Set();
  if (noTrumpRounds >= 1) noTrumpIndices.add(midIndex);
  if (noTrumpRounds >= 2) noTrumpIndices.add(midIndex + 1);

  return sequence.map((cardsPerPlayer, i) => ({
    cardsPerPlayer,
    noTrump: noTrumpIndices.has(i),
  }));
}

/** Returns the default auto peak for a given player count. */
export function autoPeak(numPlayers) {
  return Math.floor(52 / numPlayers);
}
