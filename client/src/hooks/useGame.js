import { useEffect, useState, useCallback } from 'react';

/**
 * Manages all game state received from the server and exposes
 * action helpers that emit socket events.
 */
export function useGame(socket) {
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('game:state', (state) => {
      setGameState(state);
      setError(null);
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    // Clear error after 4 seconds
    let timer;
    if (error) timer = setTimeout(() => setError(null), 4000);

    return () => {
      socket.off('game:state');
      socket.off('error');
      clearTimeout(timer);
    };
  }, [socket, error]);

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

  return {
    gameState,
    error,
    actions: { createRoom, joinRoom, updateConfig, startGame, placeBid, playCard, nextRound },
  };
}
