import { useEffect, useState, useCallback, useRef } from 'react';

const SESSION_KEY = 'bugger-bridge-session';

/**
 * Manages all game state received from the server and exposes
 * action helpers that emit socket events.
 */
export function useGame(socket) {
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const reconnecting = useRef(false);

  useEffect(() => {
    if (!socket) return;

    function handleConnect() {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) return;
      try {
        const { code, username } = JSON.parse(saved);
        reconnecting.current = true;
        socket.emit('room:reconnect', { code, username });
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    function handleState(state) {
      reconnecting.current = false;
      setGameState(state);
      setError(null);

      // Persist session so page refresh can reconnect
      const me = state.players?.[state.myIndex];
      if (me && state.code && state.phase !== 'finished') {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ code: state.code, username: me.username }));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    function handleError({ message }) {
      // If a reconnect attempt failed, clear stale session and go back to lobby
      if (reconnecting.current) {
        reconnecting.current = false;
        localStorage.removeItem(SESSION_KEY);
      }
      setError(message);
    }

    function handleKicked() {
      localStorage.removeItem(SESSION_KEY);
      setGameState(null);
      setError('You were removed from the room.');
    }

    socket.on('connect', handleConnect);
    socket.on('game:state', handleState);
    socket.on('error', handleError);
    socket.on('kicked', handleKicked);

    // If socket is already connected (e.g. effect ran after connect fired), try now
    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('game:state', handleState);
      socket.off('error', handleError);
      socket.off('kicked', handleKicked);
    };
  }, [socket]);

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

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

  const playCard = useCallback((card) => {
    socket?.emit('game:playCard', { card });
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
    localStorage.removeItem(SESSION_KEY);
    setGameState(null);
  }, []);

  return {
    gameState,
    error,
    actions: { createRoom, joinRoom, updateConfig, setCohost, kickPlayer, startGame, placeBid, playCard, nextRound, clearGame },
  };
}
