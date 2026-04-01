import React from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { useGame } from './hooks/useGame';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';

function AppInner() {
  const { socket } = useSocket();
  const { gameState, error, actions } = useGame(socket);

  if (!gameState) {
    return <Lobby onCreate={actions.createRoom} onJoin={actions.joinRoom} error={error} />;
  }

  if (gameState.phase === 'finished') {
    return <GameOver gameState={gameState} />;
  }

  return (
    <GameBoard
      gameState={gameState}
      error={error}
      actions={actions}
    />
  );
}

export default function App() {
  return (
    <SocketProvider>
      <AppInner />
    </SocketProvider>
  );
}
