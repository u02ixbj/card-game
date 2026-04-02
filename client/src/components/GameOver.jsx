import React from 'react';
import styles from './GameOver.module.css';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GameOver({ gameState, onExit }) {
  const { players, scores } = gameState;

  const ranked = players
    .map((p, i) => ({ username: p.username, score: scores[i], originalIndex: i }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Game Over</h1>
        <p className={styles.winner}>{ranked[0].username} wins!</p>

        <ol className={styles.podium}>
          {ranked.map((p, rank) => (
            <li key={p.originalIndex} className={`${styles.podiumRow} ${rank === 0 ? styles.first : ''}`}>
              <span className={styles.rank}>
                {MEDALS[rank] ?? `${rank + 1}.`}
              </span>
              <span className={styles.name}>{p.username}</span>
              <span className={styles.score}>{p.score} pts</span>
            </li>
          ))}
        </ol>

        <button className="btn-primary" onClick={onExit}>
          Exit to lobby
        </button>
      </div>
    </div>
  );
}
