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

  // Add extra peak rounds in the middle until divisible by numPlayers.
  // Keeps start === end === minCards and never appends rounds after the descent.
  let numPeakRounds = 1;
  let totalLen = ascending.length + descending.length;
  while (totalLen % numPlayers !== 0) {
    numPeakRounds++;
    totalLen++;
  }

  const sequence = [
    ...ascending,
    ...Array(numPeakRounds - 1).fill(resolvedPeak),
    ...descending,
  ];

  const peakStart = ascending.length - 1;
  const peakEnd = peakStart + numPeakRounds - 1;
  const midPeak = Math.floor((peakStart + peakEnd) / 2);
  const noTrumpIndices = new Set();
  if (noTrumpRounds >= 1) noTrumpIndices.add(midPeak);
  if (noTrumpRounds >= 2) noTrumpIndices.add(midPeak + 1 <= peakEnd ? midPeak + 1 : midPeak - 1);

  return sequence.map((cardsPerPlayer, i) => ({
    cardsPerPlayer,
    noTrump: noTrumpIndices.has(i),
  }));
}

/** Returns the default auto peak for a given player count. */
export function autoPeak(numPlayers) {
  return Math.floor(52 / numPlayers);
}

const SUIT_ORDER = { clubs: 0, spades: 1, hearts: 2, diamonds: 3 };
const RANK_VALUES = { '2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':9,'Q':10,'K':11,'A':12 };

/** Sorts cards by suit (clubs → spades → hearts → diamonds), then rank high→low. */
export function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    if (suitDiff !== 0) return suitDiff;
    return RANK_VALUES[b.rank] - RANK_VALUES[a.rank];
  });
}
