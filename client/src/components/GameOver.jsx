import React from 'react';
import ScoreTable from './ScoreTable';
import styles from './GameOver.module.css';

export default function GameOver({ gameState }) {
  const { players, scores } = gameState;

  const ranked = players
    .map((p, i) => ({ ...p, score: scores[i] }))
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Game Over</h1>
        <p className={styles.winner}>{winner.username} wins!</p>

        <ScoreTable players={players} scores={scores} />

        <button
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Play again
        </button>
      </div>
    </div>
  );
}
