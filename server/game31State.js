/**
 * 31 — Game Logic
 *
 * Pure functions that mutate the room.game31 object in place and return
 * { room } on success or { error } on failure.
 */

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (['K', 'Q', 'J', '10'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

function handScore(hand) {
  const suitTotals = {};
  for (const card of hand) {
    suitTotals[card.suit] = (suitTotals[card.suit] || 0) + cardValue(card);
  }
  return Math.max(...Object.values(suitTotals));
}

// ---------------------------------------------------------------------------
// Round end logic
// ---------------------------------------------------------------------------

function _endRound(room) {
  const g = room.game31;
  const n = room.players.length;

  const scores = g.hands.map((hand, i) => (g.active[i] ? handScore(hand) : null));

  const newLives = [...g.lives];
  let loserIndices = [];

  if (g.blitzerIndex !== null) {
    // Everyone except the blitzer loses a life
    for (let i = 0; i < n; i++) {
      if (i !== g.blitzerIndex && g.active[i]) {
        newLives[i] = Math.max(0, newLives[i] - 1);
        loserIndices.push(i);
      }
    }
  } else {
    // Lowest scorer(s) lose a life
    const activeScores = scores.map((s, i) => (g.active[i] ? s : Infinity));
    const minScore = Math.min(...activeScores);
    loserIndices = activeScores.reduce((acc, s, i) => (s === minScore ? [...acc, i] : acc), []);
    for (const i of loserIndices) {
      newLives[i] = Math.max(0, newLives[i] - 1);
    }
  }

  const eliminated = g.active.map((a, i) => a && newLives[i] === 0);
  const newActive = g.active.map((a, i) => a && newLives[i] > 0);

  // One Tie All Tie: if no active players remain, everyone comes back with 3 lives
  let oneTieAllTie = false;
  if (!newActive.some(Boolean)) {
    oneTieAllTie = true;
    newLives.fill(3);
    newActive.fill(true);
  }

  g.lives = newLives;
  g.active = newActive;
  g.phase = 'roundOver';
  g.roundResult = {
    blitzerIndex: g.blitzerIndex,
    loserIndices,
    scores,
    hands: g.hands,
    livesAfter: newLives,
    eliminated,
    oneTieAllTie,
  };

  // Check if game over (exactly 1 active player remains and no tie reset)
  const remaining = newActive.filter(Boolean).length;
  if (remaining <= 1 && !oneTieAllTie) {
    room.phase = 'finished';
    room.game31Winner = newActive.findIndex(Boolean); // -1 if somehow all eliminated
  }
}

// ---------------------------------------------------------------------------
// Turn advancement
// ---------------------------------------------------------------------------

function _advanceTurn(room) {
  const g = room.game31;
  const n = room.players.length;

  // In knock sequence: step through knockPlayersLeft
  if (g.knockPlayersLeft !== null) {
    g.knockPlayersLeft.shift();
    if (g.knockPlayersLeft.length === 0) {
      _endRound(room);
      return;
    }
    g.currentPlayerIndex = g.knockPlayersLeft[0];
    g.phase = 'drawing';
    return;
  }

  // Stock empty → end round
  if (g.stock.length === 0) {
    _endRound(room);
    return;
  }

  // Find next active player
  let next = (g.currentPlayerIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (g.active[next]) break;
    next = (next + 1) % n;
  }
  g.currentPlayerIndex = next;
  g.phase = 'drawing';
}

// ---------------------------------------------------------------------------
// Exported actions
// ---------------------------------------------------------------------------

function startGame31(room, hostId) {
  if (room.hostId !== hostId) return { error: 'Only the host can start the game' };
  if (room.phase !== 'lobby') return { error: 'Game already started' };
  if (room.players.length < 2) return { error: 'Need at least 2 players to start' };

  const n = room.players.length;
  const deck = shuffle(createDeck());

  const hands = [];
  for (let i = 0; i < n; i++) {
    hands.push([deck.shift(), deck.shift(), deck.shift()]);
  }

  const discard = [deck.pop()];

  room.phase = 'playing';
  room.game31 = {
    phase: 'drawing',
    roundNumber: 1,
    dealerIndex: 0,
    currentPlayerIndex: n > 1 ? 1 : 0,
    hands,
    stock: deck,
    discard,
    knockerIndex: null,
    knockPlayersLeft: null,
    blitzerIndex: null,
    lives: new Array(n).fill(3),
    active: new Array(n).fill(true),
    roundResult: null,
  };

  return { room };
}

function _startRound(room) {
  const g = room.game31;
  const n = room.players.length;
  const deck = shuffle(createDeck());

  const hands = new Array(n).fill(null).map(() => []);
  for (let i = 0; i < n; i++) {
    if (g.active[i]) {
      hands[i] = [deck.shift(), deck.shift(), deck.shift()];
    }
  }

  const discard = [deck.pop()];

  // Rotate dealer among active players
  let nextDealer = (g.dealerIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (g.active[nextDealer]) break;
    nextDealer = (nextDealer + 1) % n;
  }

  let firstPlayer = (nextDealer + 1) % n;
  for (let i = 0; i < n; i++) {
    if (g.active[firstPlayer]) break;
    firstPlayer = (firstPlayer + 1) % n;
  }

  g.phase = 'drawing';
  g.roundNumber += 1;
  g.dealerIndex = nextDealer;
  g.currentPlayerIndex = firstPlayer;
  g.hands = hands;
  g.stock = deck;
  g.discard = discard;
  g.knockerIndex = null;
  g.knockPlayersLeft = null;
  g.blitzerIndex = null;
  g.roundResult = null;
}

function draw31(room, playerId) {
  const g = room.game31;
  const pi = room.players.findIndex(p => p.id === playerId);
  if (pi !== g.currentPlayerIndex) return { error: 'Not your turn' };
  if (g.phase !== 'drawing') return { error: 'Not your draw turn' };
  if (!g.active[pi]) return { error: 'You are eliminated' };

  if (g.stock.length === 0) {
    _endRound(room);
    return { room };
  }

  g.hands[pi].push(g.stock.pop());
  g.phase = 'discarding';
  return { room };
}

function takeDiscard31(room, playerId) {
  const g = room.game31;
  const pi = room.players.findIndex(p => p.id === playerId);
  if (pi !== g.currentPlayerIndex) return { error: 'Not your turn' };
  if (g.phase !== 'drawing') return { error: 'Not your draw turn' };
  if (!g.active[pi]) return { error: 'You are eliminated' };
  if (g.discard.length === 0) return { error: 'Discard pile is empty' };

  g.hands[pi].push(g.discard.pop());
  g.phase = 'discarding';
  return { room };
}

function discard31(room, playerId, card) {
  const g = room.game31;
  const pi = room.players.findIndex(p => p.id === playerId);
  if (pi !== g.currentPlayerIndex) return { error: 'Not your turn' };
  if (g.phase !== 'discarding') return { error: 'Not your discard turn' };
  if (!g.active[pi]) return { error: 'You are eliminated' };

  const hand = g.hands[pi];
  const idx = hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
  if (idx === -1) return { error: 'Card not in hand' };

  hand.splice(idx, 1);
  g.discard.push(card);

  // Check blitz (exactly 31 after discarding)
  if (handScore(hand) === 31) {
    g.blitzerIndex = pi;
    _endRound(room);
    return { room, blitz: true };
  }

  _advanceTurn(room);
  return { room };
}

function knock31(room, playerId) {
  const g = room.game31;
  const pi = room.players.findIndex(p => p.id === playerId);
  if (pi !== g.currentPlayerIndex) return { error: 'Not your turn' };
  if (g.phase !== 'drawing') return { error: 'Can only knock on your draw turn' };
  if (!g.active[pi]) return { error: 'You are eliminated' };
  if (g.knockerIndex !== null) return { error: 'Someone already knocked' };

  g.knockerIndex = pi;

  // Build ordered list of remaining players who get one final turn
  const n = room.players.length;
  const knockPlayersLeft = [];
  let next = (pi + 1) % n;
  for (let i = 0; i < n - 1; i++) {
    if (g.active[next]) knockPlayersLeft.push(next);
    next = (next + 1) % n;
  }

  if (knockPlayersLeft.length === 0) {
    _endRound(room);
    return { room };
  }

  g.knockPlayersLeft = knockPlayersLeft;
  g.currentPlayerIndex = knockPlayersLeft[0];
  g.phase = 'drawing';
  return { room };
}

function nextRound31(room, playerId) {
  const pi = room.players.findIndex(p => p.id === playerId);
  const isAuth = room.hostId === playerId || room.cohosts?.includes(pi);
  if (!isAuth) return { error: 'Only the host or co-host can advance' };
  if (room.game31.phase !== 'roundOver') return { error: 'Round is not over yet' };
  if (room.phase === 'finished') return { error: 'Game is already finished' };

  _startRound(room);
  return { room };
}

// ---------------------------------------------------------------------------
// Public state (hides other players' hands)
// ---------------------------------------------------------------------------

function getPublicState31(room, playerId) {
  const g = room.game31;
  const pi = room.players.findIndex(p => p.id === playerId);

  return {
    code: room.code,
    gameType: '31',
    phase: room.phase,
    players: room.players.map(p => ({ username: p.username, connected: p.connected })),
    myIndex: pi,
    cohosts: room.cohosts,
    config: room.config,
    winner: room.game31Winner ?? null,
    game31: g ? {
      phase: g.phase,
      roundNumber: g.roundNumber,
      dealerIndex: g.dealerIndex,
      currentPlayerIndex: g.currentPlayerIndex,
      lives: g.lives,
      active: g.active,
      knockerIndex: g.knockerIndex,
      blitzerIndex: g.blitzerIndex,
      stockCount: g.stock.length,
      topDiscard: g.discard.length > 0 ? g.discard[g.discard.length - 1] : null,
      myHand: pi >= 0 && g.hands[pi] ? g.hands[pi] : [],
      myScore: pi >= 0 && g.hands[pi] && g.hands[pi].length > 0 ? handScore(g.hands[pi]) : 0,
      roundResult: g.roundResult,
    } : null,
  };
}

module.exports = {
  startGame31,
  draw31,
  takeDiscard31,
  discard31,
  knock31,
  nextRound31,
  getPublicState31,
  handScore,
};
