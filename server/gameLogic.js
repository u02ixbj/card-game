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
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
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
function dealCards(numPlayers, cardsPerPlayer, noTrump = false) {
  const deck = shuffleDeck(createDeck());
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
    // Default peak: as high as the deck allows
    peakCards = Math.floor(52 / numPlayers);
  }

  // Build the ascending+descending sequence (excluding peak duplicates)
  const ascending = [];
  for (let c = minCards; c <= peakCards; c++) ascending.push(c);
  const descending = ascending.slice(0, -1).reverse(); // drop peak, reverse
  let sequence = [...ascending, ...descending];

  // Trim or extend to ensure total rounds % numPlayers === 0
  while (sequence.length % numPlayers !== 0) {
    sequence.push(sequence[sequence.length - 1] + 1 <= peakCards
      ? sequence[sequence.length - 1] + 1
      : minCards);
  }

  // Place no-trump rounds at/around the peak (middle of sequence)
  const midIndex = Math.floor((sequence.length - 1) / 2);
  const noTrumpIndices = new Set();
  if (noTrumpRounds >= 1) noTrumpIndices.add(midIndex);
  if (noTrumpRounds >= 2) noTrumpIndices.add(midIndex + 1);

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
  const challengerIsTrump = trumpSuit && challenger.suit === trumpSuit;
  const currentIsTrump = trumpSuit && current.suit === trumpSuit;

  if (challengerIsTrump && !currentIsTrump) return true;
  if (!challengerIsTrump && currentIsTrump) return false;

  // Both trump or both non-trump: only beats if same suit and higher rank
  if (challenger.suit !== current.suit) return false;
  return RANK_VALUES[challenger.rank] > RANK_VALUES[current.rank];
}

/**
 * Returns the cards from `hand` that are legal to play given the led suit.
 * If the player has any cards of the led suit they must play one.
 * Otherwise any card is legal.
 */
function legalPlays(hand, ledSuit) {
  if (!ledSuit) return hand; // player is leading
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
