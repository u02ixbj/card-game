/**
 * Bugger Bridge — Core Game Logic
 * Pure functions only. No server or UI dependencies.
 */

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
// Index = rank value (higher index = higher card)
const RANK_VALUES = Object.fromEntries(RANKS.map((r, i) => [r, i]));

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

/**
 * Returns a fresh unshuffled 52-card deck.
 * Each card: { suit: string, rank: string }
 */
function createDeck(useJokers = false) {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  if (useJokers) {
    deck.push({ suit: 'joker', rank: 'big' });
    deck.push({ suit: 'joker', rank: 'small' });
  }
  return deck;
}

/**
 * Returns a new shuffled copy of the deck (Fisher-Yates).
 */
function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

/**
 * Deals `cardsPerPlayer` cards to each of `numPlayers` players from a
 * shuffled deck.
 *
 * Returns:
 *   hands       — array of `numPlayers` card arrays
 *   trumpCard   — the card flipped to determine trump (or null for no-trump)
 *   remaining   — leftover cards after dealing and flipping trump
 */
function dealCards(numPlayers, cardsPerPlayer, noTrump = false, useJokers = false) {
  const deck = shuffleDeck(createDeck(useJokers));
  const hands = Array.from({ length: numPlayers }, () => []);

  for (let i = 0; i < cardsPerPlayer * numPlayers; i++) {
    hands[i % numPlayers].push(deck[i]);
  }

  const remaining = deck.slice(cardsPerPlayer * numPlayers);
  const trumpCard = noTrump ? null : (remaining[0] ?? null);

  return { hands, trumpCard, remaining };
}

/**
 * Deals cards one at a time to find the first dealer (first player to
 * receive a Jack). Returns the 0-based index of the first dealer.
 */
function determineFirstDealer(numPlayers) {
  const deck = shuffleDeck(createDeck());
  for (let i = 0; i < deck.length; i++) {
    if (deck[i].rank === 'J') {
      return i % numPlayers;
    }
  }
  // Should never happen with a full deck
  return 0;
}

// ---------------------------------------------------------------------------
// Round sequence
// ---------------------------------------------------------------------------

/**
 * Generates the round card-count sequence for a game.
 *
 * Rules:
 *   - Starts at `minCards`, rises by 1 each round to `peakCards`, then
 *     descends back. Total rounds must be divisible by `numPlayers`.
 *   - No-trump rounds are placed at the peak (0, 1, or 2 rounds).
 *
 * Returns an array of objects: { cardsPerPlayer, noTrump }
 */
function generateRoundSequence(numPlayers, peakCards = null, noTrumpRounds = 0, minCards = 3) {
  if (peakCards === null) {
    peakCards = Math.floor(52 / numPlayers);
  }

  const ascending = [];
  for (let c = minCards; c <= peakCards; c++) ascending.push(c);
  const descending = ascending.slice(0, -1).reverse();

  // Base sequence has 1 peak round. Add extra peak rounds in the middle until
  // total is divisible by numPlayers. This keeps start === end === minCards
  // and never adds rounds that go back up after the descent.
  let numPeakRounds = 1;
  let totalLen = ascending.length + descending.length;
  while (totalLen % numPlayers !== 0) {
    numPeakRounds++;
    totalLen++;
  }

  const sequence = [
    ...ascending,
    ...Array(numPeakRounds - 1).fill(peakCards),
    ...descending,
  ];

  // Place no-trump rounds at the centre of the peak plateau
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

// ---------------------------------------------------------------------------
// Bidding
// ---------------------------------------------------------------------------

/**
 * Returns true if `bid` is legal for the dealer.
 * The dealer cannot make the sum of all bids equal to `tricksAvailable`.
 */
function isValidDealerBid(bid, otherBidsTotal, tricksAvailable) {
  return bid + otherBidsTotal !== tricksAvailable;
}

/**
 * Returns true if `bid` is a valid bid for a non-dealer player.
 */
function isValidBid(bid, tricksAvailable) {
  return Number.isInteger(bid) && bid >= 0 && bid <= tricksAvailable;
}

// ---------------------------------------------------------------------------
// Trick resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a single trick and returns the 0-based index of the winning play.
 *
 * `trick` — array of { playerIndex, card } in play order
 * `trumpSuit` — string suit name, or null for no-trump
 * `ledSuit`  — the suit of the first card played (derived from trick[0])
 */
function resolveTrick(trick, trumpSuit) {
  if (trick.length === 0) throw new Error('Cannot resolve empty trick');

  const ledSuit = trick[0].card.suit;
  let winningPlay = trick[0];

  for (let i = 1; i < trick.length; i++) {
    const challenger = trick[i];
    if (beats(challenger.card, winningPlay.card, trumpSuit, ledSuit)) {
      winningPlay = challenger;
    }
  }

  return winningPlay.playerIndex;
}

/**
 * Returns true if `challenger` beats `current` given trump and led suit.
 */
function beats(challenger, current, trumpSuit, ledSuit) {
  // Jokers outrank everything: big > small > all other cards
  const jokerRank = r => (r === 'big' ? 2 : r === 'small' ? 1 : 0);
  const challengerIsJoker = challenger.suit === 'joker';
  const currentIsJoker = current.suit === 'joker';

  if (challengerIsJoker && currentIsJoker) return jokerRank(challenger.rank) > jokerRank(current.rank);
  if (challengerIsJoker) return true;
  if (currentIsJoker) return false;

  const challengerIsTrump = trumpSuit && challenger.suit === trumpSuit;
  const currentIsTrump = trumpSuit && current.suit === trumpSuit;

  if (challengerIsTrump && !currentIsTrump) return true;
  if (!challengerIsTrump && currentIsTrump) return false;

  // Both trump or both non-trump: only beats if same suit and higher rank
  if (challenger.suit !== current.suit) return false;
  return RANK_VALUES[challenger.rank] > RANK_VALUES[current.rank];
}

/**
 * Returns the cards from `hand` that are legal to play.
 *
 * Joker rules:
 *  - In trump rounds, jokers count as trump for following purposes.
 *  - If a joker led in a no-trump round (jokerWasLed && !trumpSuit), the
 *    other joker is never forced — follow the declared suit with a regular
 *    card instead. The other joker is still an optional legal play.
 */
function legalPlays(hand, ledSuit, trumpSuit = null, jokerWasLed = false) {
  if (!ledSuit) return hand; // player is leading — anything goes

  const isTrumpLed = trumpSuit && ledSuit === trumpSuit;

  if (isTrumpLed) {
    // Must play trump (regular trump cards or jokers)
    const trumpCards = hand.filter(c => c.suit === 'joker' || c.suit === trumpSuit);
    return trumpCards.length > 0 ? trumpCards : hand;
  }

  if (jokerWasLed && !trumpSuit) {
    // No-trump joker lead: follow declared suit; other joker is optional, not forced
    const suitedCards = hand.filter(c => c.suit === ledSuit);
    const jokersInHand = hand.filter(c => c.suit === 'joker');
    if (suitedCards.length > 0) return [...suitedCards, ...jokersInHand];
    return hand; // no declared-suit cards — other joker not forced, play anything
  }

  // Normal: must follow led suit if possible (jokers are not led-suit cards)
  const suited = hand.filter(c => c.suit === ledSuit);
  return suited.length > 0 ? suited : hand;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Returns the points awarded for taking exactly `tricksTaken` tricks
 * when the bid was `bid`. Returns 0 if bid !== tricksTaken.
 *
 * Formula: 10 + (bid * (bid + 1)) / 2
 */
function calculateScore(bid, tricksTaken) {
  if (bid !== tricksTaken) return 0;
  return 10 + (bid * (bid + 1)) / 2;
}

/**
 * Computes end-of-round scores for all players.
 *
 * `playerResults` — array of { playerIndex, bid, tricksTaken }
 * Returns array of { playerIndex, pointsEarned }
 */
function scoreRound(playerResults) {
  return playerResults.map(({ playerIndex, bid, tricksTaken }) => ({
    playerIndex,
    pointsEarned: calculateScore(bid, tricksTaken),
  }));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SUITS,
  RANKS,
  RANK_VALUES,
  createDeck,
  shuffleDeck,
  dealCards,
  determineFirstDealer,
  generateRoundSequence,
  isValidBid,
  isValidDealerBid,
  resolveTrick,
  beats,
  legalPlays,
  calculateScore,
  scoreRound,
};
