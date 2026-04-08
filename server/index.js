/**
 * Bugger Bridge — Express + Socket.IO Server
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const {
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
  returnToLobby,
  getPublicState,
} = require('./gameState');

const {
  startGame31,
  draw31,
  takeDiscard31,
  discard31,
  knock31,
  nextRound31,
  getPublicState31,
} = require('./game31State');

const PORT = process.env.PORT || 3001;

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ---------------------------------------------------------------------------
// Static / health
// ---------------------------------------------------------------------------

app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Emits the current public state to every player in the room.
 * Routes to the correct state builder based on game type.
 */
function broadcastRoom(room) {
  for (const player of room.players) {
    if (player.connected) {
      const state = room.gameType === '31'
        ? getPublicState31(room, player.id)
        : getPublicState(room.code, player.id);
      io.to(player.id).emit('game:state', state);
    }
  }
}

/**
 * Emits an error back to a single socket.
 */
function emitError(socket, message) {
  socket.emit('error', { message });
}

// ---------------------------------------------------------------------------
// Socket.IO events
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // --- Lobby ---

  /**
   * Create a new room.
   * Payload: { username: string }
   * Response: game:state (full state) emitted to creator
   */
  socket.on('room:create', ({ username, gameType } = {}) => {
    if (!username?.trim()) return emitError(socket, 'Username is required');
    const type = ['bugger-bridge', '31'].includes(gameType) ? gameType : 'bugger-bridge';

    const room = createRoom(socket.id, username.trim(), type);
    socket.join(room.code);
    console.log(`[room:create] ${room.code} (${type}) by ${username}`);

    broadcastRoom(room);
  });

  /**
   * Join an existing room.
   * Payload: { code: string, username: string }
   */
  socket.on('room:join', ({ code, username } = {}) => {
    if (!code?.trim() || !username?.trim()) return emitError(socket, 'Code and username are required');

    const result = joinRoom(code.toUpperCase().trim(), socket.id, username.trim());
    if (result.error) return emitError(socket, result.error);

    socket.join(result.room.code);
    console.log(`[room:join] ${username} joined ${code}`);
    broadcastRoom(result.room);
  });

  /**
   * Reconnect to a room after a page refresh / disconnect.
   * Payload: { code: string, username: string }
   */
  socket.on('room:reconnect', ({ code, username } = {}) => {
    if (!code?.trim() || !username?.trim()) return emitError(socket, 'Code and username are required');

    const result = reconnectPlayer(code.toUpperCase().trim(), socket.id, username.trim());
    if (result.error) return emitError(socket, result.error);

    socket.join(result.room.code);
    console.log(`[room:reconnect] ${username} reconnected to ${code}`);
    broadcastRoom(result.room);
  });

  /**
   * Host updates game configuration.
   * Payload: { peakCards?, noTrumpRounds?, minCards? }
   */
  socket.on('room:config', (config = {}) => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');

    const result = updateConfig(room.code, socket.id, config);
    if (result.error) return emitError(socket, result.error);

    broadcastRoom(result.room);
  });

  /**
   * Host kicks a player from the lobby.
   * Payload: { targetIndex: number }
   */
  socket.on('room:kick', ({ targetIndex } = {}) => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');

    const result = kickPlayer(room.code, socket.id, targetIndex);
    if (result.error) return emitError(socket, result.error);

    if (result.kickedSocketId) {
      io.to(result.kickedSocketId).emit('kicked');
    }
    broadcastRoom(result.room);
  });

  /**
   * Host toggles co-host status for a player.
   * Payload: { targetIndex: number, value: boolean }
   */
  socket.on('room:setCohost', ({ targetIndex, value } = {}) => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');

    const result = setCohost(room.code, socket.id, targetIndex, value);
    if (result.error) return emitError(socket, result.error);

    broadcastRoom(result.room);
  });

  /**
   * Host starts the game.
   * Payload: none
   */
  socket.on('game:start', () => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');

    const result = room.gameType === '31'
      ? startGame31(room, socket.id)
      : startGame(room.code, socket.id);
    if (result.error) return emitError(socket, result.error);

    console.log(`[game:start] ${room.code} (${room.gameType})`);
    broadcastRoom(result.room);
  });

  // --- Bidding ---

  /**
   * Place a bid.
   * Payload: { bid: number }
   */
  socket.on('game:bid', ({ bid } = {}) => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');
    if (bid === undefined || bid === null) return emitError(socket, 'Bid is required');

    const result = placeBid(room.code, socket.id, Number(bid));
    if (result.error) return emitError(socket, result.error);

    broadcastRoom(result.room);
  });

  // --- Playing cards ---

  /**
   * Play a card.
   * Payload: { card: { suit: string, rank: string } }
   */
  socket.on('game:playCard', ({ card, declaredSuit } = {}) => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');
    if (!card?.suit || !card?.rank) return emitError(socket, 'Invalid card');

    const result = playCard(room.code, socket.id, card, declaredSuit);
    if (result.error) return emitError(socket, result.error);

    broadcastRoom(result.room);

    if (result.trickComplete) {
      io.to(room.code).emit('game:trickComplete', {
        tricks: result.room.game?.round?.tricks ?? [],
        tricksTaken: result.room.game?.round?.tricksTaken ?? [],
      });
    }

    if (result.roundComplete) {
      io.to(room.code).emit('game:roundComplete', {
        scores: result.room.game?.scores ?? [],
        phase: result.room.phase,
      });
    }
  });

  /**
   * Host advances to the next round after all players have seen the scores.
   * Payload: none
   */
  socket.on('game:nextRound', () => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');

    const result = room.gameType === '31'
      ? nextRound31(room, socket.id)
      : advanceToNextRound(room.code, socket.id);
    if (result.error) return emitError(socket, result.error);

    broadcastRoom(result.room);
  });

  // --- 31-specific actions ---

  socket.on('game31:draw', () => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');
    const result = draw31(room, socket.id);
    if (result.error) return emitError(socket, result.error);
    broadcastRoom(result.room);
  });

  socket.on('game31:takeDiscard', () => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');
    const result = takeDiscard31(room, socket.id);
    if (result.error) return emitError(socket, result.error);
    broadcastRoom(result.room);
  });

  socket.on('game31:discard', ({ card } = {}) => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');
    if (!card?.rank || !card?.suit) return emitError(socket, 'Invalid card');
    const result = discard31(room, socket.id, card);
    if (result.error) return emitError(socket, result.error);
    broadcastRoom(result.room);
  });

  socket.on('game31:knock', () => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');
    const result = knock31(room, socket.id);
    if (result.error) return emitError(socket, result.error);
    broadcastRoom(result.room);
  });

  /**
   * Host ends the game early and returns all players to the lobby.
   * Payload: none
   */
  socket.on('game:endGame', () => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');

    const result = returnToLobby(room.code, socket.id);
    if (result.error) return emitError(socket, result.error);

    console.log(`[game:endGame] ${room.code}`);
    broadcastRoom(result.room);
  });

  // --- Chat ---

  socket.on('chat:message', ({ text } = {}) => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !text?.trim()) return;

    io.to(room.code).emit('chat:message', {
      username: player.username,
      text: text.trim().slice(0, 200),
    });
  });

  // --- Disconnect ---

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const room = playerDisconnected(socket.id);
    if (room) broadcastRoom(room);
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`Bugger Bridge server running on port ${PORT}`);
});
