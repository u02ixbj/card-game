import React from 'react';
import styles from './WaitingRoom.module.css';

export default function WaitingRoom({ gameState, actions }) {
  const { code, players, hostId, config } = gameState;
  const { socket } = { socket: null }; // hostId comparison uses socket.id stored in gameState
  const isHost = players[0]?.username === players.find(p => p.connected)?.username; // simplified

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h2>Room <span className={styles.code}>{code}</span></h2>
        <p className={styles.hint}>Share this code with other players</p>

        <ul className={styles.playerList}>
          {players.map((p, i) => (
            <li key={i} className={p.connected ? '' : styles.disconnected}>
              {p.username} {i === 0 ? '👑' : ''} {!p.connected ? '(disconnected)' : ''}
            </li>
          ))}
        </ul>

        <p className={styles.count}>{players.length} / 8 players</p>

        <div className={styles.config}>
          <h3>Game Settings</h3>
          <label>
            No-trump rounds
            <select
              value={config.noTrumpRounds}
              onChange={e => actions.updateConfig({ noTrumpRounds: Number(e.target.value) })}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        </div>

        <button
          className="btn-primary"
          onClick={actions.startGame}
          disabled={players.filter(p => p.connected).length < 3}
        >
          Start Game
        </button>
        {players.filter(p => p.connected).length < 3 && (
          <p className="error">Need at least 3 players</p>
        )}
      </div>
    </div>
  );
}
