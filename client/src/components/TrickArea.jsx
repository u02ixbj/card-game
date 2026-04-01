import React from 'react';
import Card from './Card';
import styles from './TrickArea.module.css';

/**
 * Shows the cards currently on the table in the active trick.
 */
export default function TrickArea({ trick, players, myIndex }) {
  if (!trick || trick.plays.length === 0) {
    return <div className={styles.empty}>Waiting for first card…</div>;
  }

  return (
    <div className={styles.area}>
      {trick.plays.map(({ playerIndex, card }) => (
        <div key={playerIndex} className={styles.play}>
          <Card card={card} disabled />
          <span className={styles.name}>
            {players[playerIndex]?.username ?? `P${playerIndex + 1}`}
            {playerIndex === myIndex ? ' (you)' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
