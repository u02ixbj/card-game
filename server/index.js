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
  getPublicState,
} = require('./gameState');

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
 */
function broadcastRoom(room) {
  for (const player of room.players) {
    if (player.connected) {
      const state = getPublicState(room.code, player.id);
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
  socket.on('room:create', ({ username } = {}) => {
    if (!username?.trim()) return emitError(socket, 'Username is required');

    const room = createRoom(socket.id, username.trim());
    socket.join(room.code);
    console.log(`[room:create] ${room.code} by ${username}`);

    const state = getPublicState(room.code, socket.id);
    socket.emit('game:state', state);
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

    const result = startGame(room.code, socket.id);
    if (result.error) return emitError(socket, result.error);

    console.log(`[game:start] ${room.code}`);
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
  socket.on('game:playCard', ({ card } = {}) => {
    const room = getRoomByPlayerId(socket.id);
    if (!room) return emitError(socket, 'Not in a room');
    if (!card?.suit || !card?.rank) return emitError(socket, 'Invalid card');

    const result = playCard(room.code, socket.id, card);
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

    const result = advanceToNextRound(room.code, socket.id);
    if (result.error) return emitError(socket, result.error);

    broadcastRoom(result.room);
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
