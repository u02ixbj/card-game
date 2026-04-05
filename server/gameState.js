/**
 * Bugger Bridge — In-Memory Game State Manager
 *
 * Manages rooms (lobbies) and active games. All state lives in memory;
 * no database required.
 */

const {
  dealCards,
  determineFirstDealer,
  generateRoundSequence,
  isValidBid,
  isValidDealerBid,
  resolveTrick,
  legalPlays,
  scoreRound,
} = require('./gameLogic');

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

// rooms: Map<roomCode, Room>
const rooms = new Map();

// ---------------------------------------------------------------------------
// Room code generation
// ---------------------------------------------------------------------------

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// ---------------------------------------------------------------------------
// Room lifecycle
// ---------------------------------------------------------------------------

/**
 * Creates a new lobby room. Returns the room object.
 *
 * Room shape:
 * {
 *   code,
 *   phase: 'lobby' | 'playing' | 'finished',
 *   players: [{ id, username, connected }],
 *   hostId,
 *   config: { peakCards, noTrumpRounds, minCards },
 *   game: GameState | null,
 * }
 */
function createRoom(hostId, hostUsername) {
  const code = generateRoomCode();
  const room = {
    code,
    phase: 'lobby',
    players: [{ id: hostId, username: hostUsername, connected: true }],
    hostId,
    cohosts: [],   // array of player indices that can advance rounds
    config: {
      peakCards: null,   // null = auto (floor(52/numPlayers))
      noTrumpRounds: 0,  // 0, 1, or 2
      minCards: 3,
      useJokers: false,
    },
    game: null,
  };
  rooms.set(code, room);
  return room;
}

/**
 * Adds a player to an existing lobby. Returns the updated room or an error string.
 */
function joinRoom(code, playerId, username) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'lobby') return { error: 'Game already in progress' };
  if (room.players.length >= 8) return { error: 'Room is full' };
  if (room.players.some(p => p.username === username)) return { error: 'Username already taken' };

  room.players.push({ id: playerId, username, connected: true });
  return { room };
}

/**
 * Marks a player as disconnected. Returns the room.
 */
function playerDisconnected(playerId) {
  for (const room of rooms.values()) {
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      return room;
    }
  }
  return null;
}

/**
 * Reconnects a player (by username) to their room. Returns { room, playerId } or error.
 */
function reconnectPlayer(code, newSocketId, username) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const player = room.players.find(p => p.username === username);
  if (!player) return { error: 'Player not found in room' };

  const oldId = player.id;
  player.id = newSocketId;
  player.connected = true;

  // Keep hostId in sync when the host reconnects with a new socket ID
  if (room.hostId === oldId) room.hostId = newSocketId;

  return { room, player };
}

/**
 * Returns the room a socket ID currently belongs to, or null.
 */
function getRoomByPlayerId(playerId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === playerId)) return room;
  }
  return null;
}

/**
 * Updates host-configurable game settings before the game starts.
 */
function updateConfig(code, hostId, config) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== hostId) return { error: 'Only the host can change settings' };
  if (room.phase !== 'lobby') return { error: 'Cannot change settings once game has started' };

  const allowed = ['peakCards', 'noTrumpRounds', 'minCards', 'useJokers'];
  for (const key of allowed) {
    if (config[key] !== undefined) room.config[key] = config[key];
  }
  return { room };
}

// ---------------------------------------------------------------------------
// Game lifecycle
// ---------------------------------------------------------------------------

/**
 * GameState shape:
 * {
 *   roundSequence: [{ cardsPerPlayer, noTrump }],
 *   roundIndex: number,           // current round (0-based)
 *   dealerIndex: number,          // index into room.players
 *   scores: [number],             // cumulative score per player
 *   round: RoundState | null,
 * }
 *
 * RoundState shape:
 * {
 *   cardsPerPlayer,
 *   noTrump,
 *   trumpCard,
 *   hands: [[card]],              // indexed by player position
 *   bids: [number|null],
 *   bidOrder: [playerIndex],      // order bids are collected
 *   currentBidderIndex: number,   // index into bidOrder
 *   tricks: [TrickState],
 *   tricksTaken: [number],
 *   currentTrick: TrickState | null,
 *   phase: 'bidding' | 'playing' | 'roundOver',
 * }
 *
 * TrickState shape: { plays: [{ playerIndex, card }], ledSuit: string|null }
 */

/**
 * Starts the game. Returns the updated room or an error string.
 */
function startGame(code, hostId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== hostId) return { error: 'Only the host can start the game' };
  if (room.phase !== 'lobby') return { error: 'Game already started' };
  if (room.players.length < 2) return { error: 'Need at least 2 players to start' };

  const numPlayers = room.players.length;
  const { peakCards, noTrumpRounds, minCards } = room.config;

  const roundSequence = generateRoundSequence(numPlayers, peakCards, noTrumpRounds, minCards);
  const firstDealerIndex = determineFirstDealer(numPlayers);

  room.phase = 'playing';
  room.game = {
    roundSequence,
    roundIndex: 0,
    dealerIndex: firstDealerIndex,
    scores: new Array(numPlayers).fill(0),
    round: null,
  };

  _startRound(room);
  return { room };
}

/**
 * Internal: initialises a new round on an already-started game.
 */
function _startRound(room) {
  const { game } = room;
  const { cardsPerPlayer, noTrump } = game.roundSequence[game.roundIndex];
  const numPlayers = room.players.length;

  const { hands, trumpCard } = dealCards(numPlayers, cardsPerPlayer, noTrump, room.config.useJokers);

  // Bidding starts left of dealer, dealer bids last
  const bidOrder = [];
  for (let i = 1; i <= numPlayers; i++) {
    bidOrder.push((game.dealerIndex + i) % numPlayers);
  }

  game.round = {
    cardsPerPlayer,
    noTrump,
    trumpCard,
    hands,
    bids: new Array(numPlayers).fill(null),
    bidOrder,
    currentBidderIndex: 0,
    tricks: [],
    tricksTaken: new Array(numPlayers).fill(0),
    currentTrick: null,
    phase: 'bidding',
  };
}

// ---------------------------------------------------------------------------
// Bidding
// ---------------------------------------------------------------------------

/**
 * Records a bid for the current player in the bidding sequence.
 * Returns { room } or { error }.
 */
function placeBid(code, playerId, bid) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'playing') return { error: 'Game is not in progress' };

  const { game } = room;
  const { round } = game;
  if (round.phase !== 'bidding') return { error: 'Not in bidding phase' };

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { error: 'Player not in room' };

  const expectedPlayerIndex = round.bidOrder[round.currentBidderIndex];
  if (playerIndex !== expectedPlayerIndex) return { error: 'Not your turn to bid' };

  const tricksAvailable = round.cardsPerPlayer;
  const isDealer = playerIndex === game.dealerIndex;

  if (!isValidBid(bid, tricksAvailable)) {
    return { error: `Bid must be between 0 and ${tricksAvailable}` };
  }

  if (isDealer) {
    const otherBidsTotal = round.bids.reduce((sum, b) => sum + (b ?? 0), 0);
    if (!isValidDealerBid(bid, otherBidsTotal, tricksAvailable)) {
      return { error: `Dealer cannot bid ${bid} (would make total equal tricks available)` };
    }
  }

  round.bids[playerIndex] = bid;
  round.currentBidderIndex++;

  // All bids placed — move to playing phase
  if (round.currentBidderIndex === room.players.length) {
    round.phase = 'playing';
    // First lead: player to left of dealer
    const firstLeader = (game.dealerIndex + 1) % room.players.length;
    round.currentTrick = { plays: [], ledSuit: null, leaderIndex: firstLeader };
  }

  return { room };
}

// ---------------------------------------------------------------------------
// Playing cards
// ---------------------------------------------------------------------------

/**
 * Plays a card for a player. Returns { room, trickComplete, roundComplete } or { error }.
 */
function playCard(code, playerId, card, declaredSuit) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'playing') return { error: 'Game is not in progress' };

  const { game } = room;
  const { round } = game;
  if (round.phase !== 'playing') return { error: 'Not in playing phase' };

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { error: 'Player not in room' };

  const trick = round.currentTrick;
  const expectedLeader = trick.leaderIndex;
  const numPlayers = room.players.length;
  const expectedPlayerIndex = (expectedLeader + trick.plays.length) % numPlayers;

  if (playerIndex !== expectedPlayerIndex) return { error: 'Not your turn to play' };

  const hand = round.hands[playerIndex];
  const cardIndex = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (cardIndex === -1) return { error: 'Card not in hand' };

  const trumpSuit = round.noTrump ? null : round.trumpCard?.suit ?? null;
  const legal = legalPlays(hand, trick.ledSuit, trumpSuit, trick.jokerLed ?? false);
  if (!legal.some(c => c.suit === card.suit && c.rank === card.rank)) {
    return { error: 'Must follow suit if possible' };
  }

  // Remove card from hand
  hand.splice(cardIndex, 1);

  // Add to trick — resolve led suit when leading with a joker
  if (trick.plays.length === 0) {
    if (card.suit === 'joker') {
      if (round.noTrump) {
        const VALID_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
        if (!VALID_SUITS.includes(declaredSuit)) return { error: 'Must declare a suit when leading a joker in no-trump' };
        trick.ledSuit = declaredSuit;
      } else {
        trick.ledSuit = trumpSuit; // joker automatically leads trump
      }
      trick.jokerLed = true;
    } else {
      trick.ledSuit = card.suit;
    }
  }
  trick.plays.push({ playerIndex, card });

  let trickComplete = false;
  let roundComplete = false;

  // Trick complete when all players have played
  if (trick.plays.length === numPlayers) {
    trickComplete = true;
    const trumpSuit = round.noTrump ? null : round.trumpCard?.suit ?? null;
    const winnerIndex = resolveTrick(trick.plays, trumpSuit);

    round.tricksTaken[winnerIndex]++;
    round.tricks.push(trick);

    // Check if round is over
    if (round.hands.every(h => h.length === 0)) {
      roundComplete = true;
      _endRound(room);
    } else {
      // Winner leads next trick
      round.currentTrick = { plays: [], ledSuit: null, leaderIndex: winnerIndex };
    }
  }

  return { room, trickComplete, roundComplete };
}

// ---------------------------------------------------------------------------
// Round / game end
// ---------------------------------------------------------------------------

/**
 * Internal: scores a completed round and advances to the next, or ends game.
 */
function _endRound(room) {
  const { game } = room;
  const { round } = game;

  round.phase = 'roundOver';

  const playerResults = room.players.map((_, i) => ({
    playerIndex: i,
    bid: round.bids[i],
    tricksTaken: round.tricksTaken[i],
  }));

  const roundScores = scoreRound(playerResults);
  roundScores.forEach(({ playerIndex, pointsEarned }) => {
    game.scores[playerIndex] += pointsEarned;
  });

  // Advance dealer clockwise
  game.dealerIndex = (game.dealerIndex + 1) % room.players.length;
  game.roundIndex++;

  if (game.roundIndex >= game.roundSequence.length) {
    room.phase = 'finished';
  }
}

/**
 * Kicks a player from the lobby. Only allowed before game starts.
 * Returns { room, kickedSocketId } or { error }.
 */
function kickPlayer(code, hostId, targetIndex) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== hostId) return { error: 'Only the host can kick players' };
  if (room.phase !== 'lobby') return { error: 'Cannot kick players once the game has started' };
  if (targetIndex === 0) return { error: 'Cannot kick the host' };
  if (targetIndex < 0 || targetIndex >= room.players.length) return { error: 'Invalid player' };

  const kicked = room.players.splice(targetIndex, 1)[0];

  // Rebuild cohosts: drop kicked index, decrement any higher indices
  room.cohosts = room.cohosts
    .filter(i => i !== targetIndex)
    .map(i => (i > targetIndex ? i - 1 : i));

  return { room, kickedSocketId: kicked.id };
}

/**
 * Toggles co-host status for a player. Only the host can do this.
 * `targetIndex` is the 0-based index in room.players (cannot be 0/host itself).
 */
function setCohost(code, hostId, targetIndex, value) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== hostId) return { error: 'Only the host can assign co-hosts' };
  if (targetIndex === 0) return { error: 'The host is already the host' };
  if (targetIndex < 0 || targetIndex >= room.players.length) return { error: 'Invalid player' };

  if (value) {
    if (!room.cohosts.includes(targetIndex)) room.cohosts.push(targetIndex);
  } else {
    room.cohosts = room.cohosts.filter(i => i !== targetIndex);
  }
  return { room };
}

/**
 * Advances to the next round. Call this after clients have acknowledged
 * the round-over state. Host or any co-host may call this.
 * Returns { room } or { error }.
 */
function advanceToNextRound(code, playerId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  const isAuthorized = room.hostId === playerId || room.cohosts.includes(playerIndex);
  if (!isAuthorized) return { error: 'Only the host or a co-host can advance the round' };

  if (room.phase !== 'playing') return { error: 'Game is not in progress' };
  if (room.game.round.phase !== 'roundOver') return { error: 'Round is not over yet' };

  _startRound(room);
  return { room };
}

/**
 * Returns the current public game state safe to send to a specific player.
 * Hides other players' hands.
 */
function getPublicState(code, playerId) {
  const room = rooms.get(code);
  if (!room) return null;

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  const { game } = room;

  const publicRoom = {
    code: room.code,
    phase: room.phase,
    players: room.players.map(p => ({ username: p.username, connected: p.connected })),
    hostId: room.hostId,
    cohosts: room.cohosts,
    myIndex: playerIndex,
    config: room.config,
    scores: game?.scores ?? null,
    roundIndex: game?.roundIndex ?? null,
    roundSequence: game?.roundSequence ?? null,
    dealerIndex: game?.dealerIndex ?? null,
    round: null,
  };

  if (game?.round) {
    const r = game.round;
    publicRoom.round = {
      cardsPerPlayer: r.cardsPerPlayer,
      noTrump: r.noTrump,
      trumpCard: r.trumpCard,
      bids: r.bids,
      tricksTaken: r.tricksTaken,
      phase: r.phase,
      currentBidderIndex: r.currentBidderIndex,
      bidOrder: r.bidOrder,
      currentTrick: r.currentTrick,
      completedTricks: r.tricks.length,
      lastCompletedTrick: r.tricks.length > 0 ? r.tricks[r.tricks.length - 1] : null,
      // Only send the requesting player's hand
      myHand: playerIndex >= 0 ? r.hands[playerIndex] : [],
      myIndex: playerIndex,
    };
  }

  return publicRoom;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  createRoom,
  joinRoom,
  playerDisconnected,
  reconnectPlayer,
  getRoomByPlayerId,
  updateConfig,
  kickPlayer,
  setCohost,
  startGame,
  placeBid,
  playCard,
  advanceToNextRound,
  getPublicState,
};
