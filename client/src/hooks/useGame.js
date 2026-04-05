import { useEffect, useState, useCallback, useRef } from 'react';

const SESSION_KEY = 'bugger-bridge-session';
const storage = sessionStorage; // tab-scoped: survives refresh, doesn't bleed to other tabs

/**
 * Manages all game state received from the server and exposes
 * action helpers that emit socket events.
 */
export function useGame(socket) {
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [trickWinner, setTrickWinner] = useState(null);
  const [connectionEvent, setConnectionEvent] = useState(null);
  const [messages, setMessages] = useState([]);
  const reconnecting = useRef(false);
  const prevStateRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    function handleConnect() {
      const saved = storage.getItem(SESSION_KEY);
      if (!saved) return;
      try {
        const { code, username } = JSON.parse(saved);
        reconnecting.current = true;
        socket.emit('room:reconnect', { code, username });
      } catch {
        storage.removeItem(SESSION_KEY);
      }
    }

    function handleState(state) {
      reconnecting.current = false;

      // Detect trick completion and announce the winner
      const prev = prevStateRef.current;
      if (
        prev?.round &&
        state.round &&
        state.round.completedTricks > prev.round.completedTricks
      ) {
        const winnerIndex = state.round.tricksTaken.findIndex(
          (t, i) => t > (prev.round.tricksTaken[i] ?? 0)
        );
        if (winnerIndex !== -1) {
          const winnerName = state.players[winnerIndex]?.username ?? `P${winnerIndex + 1}`;
          const lastTrick = state.round.lastCompletedTrick;
          const winnerPlay = lastTrick?.plays.find(p => p.playerIndex === winnerIndex);
          const trumpSuit = state.round.noTrump ? null : state.round.trumpCard?.suit;
          let reason = null;
          if (winnerPlay) {
            if (trumpSuit && winnerPlay.card.suit === trumpSuit && lastTrick.ledSuit !== trumpSuit) {
              reason = 'trump';
            } else {
              reason = `highest ${lastTrick.ledSuit}`;
            }
          }
          setTrickWinner({ winnerName, card: winnerPlay?.card ?? null, reason });
        }
      }

      // Detect player connection changes
      if (prev?.players) {
        for (let i = 0; i < state.players.length; i++) {
          const wasConnected = prev.players[i]?.connected;
          const isConnected = state.players[i]?.connected;
          if (wasConnected !== isConnected) {
            setConnectionEvent({ username: state.players[i].username, connected: isConnected });
            break;
          }
        }
      }

      prevStateRef.current = state;
      setGameState(state);
      setError(null);

      // Persist session so page refresh can reconnect
      const me = state.players?.[state.myIndex];
      if (me && state.code && state.phase !== 'finished') {
        storage.setItem(SESSION_KEY, JSON.stringify({ code: state.code, username: me.username }));
      } else {
        storage.removeItem(SESSION_KEY);
      }
    }

    function handleError({ message }) {
      // If a reconnect attempt failed, clear stale session and go back to lobby
      if (reconnecting.current) {
        reconnecting.current = false;
        storage.removeItem(SESSION_KEY);
      }
      setError(message);
    }

    function handleKicked() {
      storage.removeItem(SESSION_KEY);
      setGameState(null);
      setError('You were removed from the room.');
    }

    function handleChatMessage(msg) {
      setMessages(prev => [...prev, msg]);
    }

    socket.on('connect', handleConnect);
    socket.on('game:state', handleState);
    socket.on('error', handleError);
    socket.on('kicked', handleKicked);
    socket.on('chat:message', handleChatMessage);

    // If socket is already connected (e.g. effect ran after connect fired), try now
    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('game:state', handleState);
      socket.off('error', handleError);
      socket.off('kicked', handleKicked);
      socket.off('chat:message', handleChatMessage);
    };
  }, [socket]);

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  // Auto-dismiss trick winner announcement after 2 seconds
  useEffect(() => {
    if (!trickWinner) return;
    const timer = setTimeout(() => setTrickWinner(null), 2000);
    return () => clearTimeout(timer);
  }, [trickWinner]);

  // Auto-dismiss connection event after 3 seconds
  useEffect(() => {
    if (!connectionEvent) return;
    const timer = setTimeout(() => setConnectionEvent(null), 3000);
    return () => clearTimeout(timer);
  }, [connectionEvent]);

  const createRoom = useCallback((username) => {
    socket?.emit('room:create', { username });
  }, [socket]);

  const joinRoom = useCallback((code, username) => {
    socket?.emit('room:join', { code, username });
  }, [socket]);

  const updateConfig = useCallback((config) => {
    socket?.emit('room:config', config);
  }, [socket]);

  const startGame = useCallback(() => {
    socket?.emit('game:start');
  }, [socket]);

  const placeBid = useCallback((bid) => {
    socket?.emit('game:bid', { bid });
  }, [socket]);

  const playCard = useCallback((card, declaredSuit) => {
    socket?.emit('game:playCard', { card, declaredSuit });
  }, [socket]);

  const nextRound = useCallback(() => {
    socket?.emit('game:nextRound');
  }, [socket]);

  const setCohost = useCallback((targetIndex, value) => {
    socket?.emit('room:setCohost', { targetIndex, value });
  }, [socket]);

  const kickPlayer = useCallback((targetIndex) => {
    socket?.emit('room:kick', { targetIndex });
  }, [socket]);

  const clearGame = useCallback(() => {
    storage.removeItem(SESSION_KEY);
    setGameState(null);
  }, []);

  const sendMessage = useCallback((text) => {
    socket?.emit('chat:message', { text });
  }, [socket]);

  return {
    gameState,
    error,
    trickWinner,
    connectionEvent,
    messages,
    actions: { createRoom, joinRoom, updateConfig, setCohost, kickPlayer, startGame, placeBid, playCard, nextRound, clearGame, sendMessage },
  };
}
