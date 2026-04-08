import React from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { useGame } from './hooks/useGame';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import GameBoard31 from './components/GameBoard31';
import GameOver from './components/GameOver';

function AppInner() {
  const { socket } = useSocket();
  const { gameState, error, trickWinner, connectionEvent, messages, actions } = useGame(socket);

  if (!gameState) {
    return <Lobby onCreate={actions.createRoom} onJoin={actions.joinRoom} error={error} />;
  }

  if (gameState.phase === 'finished') {
    return <GameOver gameState={gameState} onExit={actions.clearGame} />;
  }

  if (gameState.gameType === '31') {
    return (
      <GameBoard31
        gameState={gameState}
        error={error}
        messages={messages}
        actions={actions}
      />
    );
  }

  return (
    <GameBoard
      gameState={gameState}
      error={error}
      trickWinner={trickWinner}
      connectionEvent={connectionEvent}
      messages={messages}
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
