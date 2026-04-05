import React from 'react';
import Card from './Card';
import styles from './TrickArea.module.css';

/**
 * Shows the cards currently on the table in the active trick.
 * Renders a slot for every player in turn order, with an empty
 * placeholder for players who haven't played yet.
 */
export default function TrickArea({ trick, players, myIndex, dealerIndex }) {
  if (!trick) {
    return <div className={styles.empty}>Waiting for first card…</div>;
  }

  const numPlayers = players.length;
  const playedByIndex = Object.fromEntries(trick.plays.map(p => [p.playerIndex, p.card]));
  const nextToPlay = trick.plays.length < numPlayers
    ? (trick.leaderIndex + trick.plays.length) % numPlayers
    : null;

  const slots = Array.from({ length: numPlayers }, (_, i) => {
    const playerIndex = (trick.leaderIndex + i) % numPlayers;
    return { playerIndex, card: playedByIndex[playerIndex] ?? null };
  });

  return (
    <div className={styles.area}>
      {slots.map(({ playerIndex, card }) => (
        <div key={playerIndex} className={styles.play}>
          {card ? (
            <Card card={card} disabled />
          ) : (
            <div className={styles.placeholder}>
              {playerIndex === nextToPlay && <span className={styles.waitingDot} aria-hidden="true" />}
            </div>
          )}
          <span className={styles.name}>
            {playerIndex === dealerIndex && <span className={styles.dealer} title="Dealer">D</span>}
            {players[playerIndex]?.username ?? `P${playerIndex + 1}`}
            {playerIndex === myIndex ? ' (you)' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
