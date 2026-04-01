import React, { useState } from 'react';
import Card from './Card';
import styles from './Hand.module.css';

/**
 * Renders the current player's hand.
 * `legalCards` — set of "rank-suit" strings the player is allowed to play.
 * Pass null to disable all cards (not your turn).
 */
export default function Hand({ cards, onPlay, legalCards }) {
  const [selected, setSelected] = useState(null);

  function handleClick(card) {
    const key = `${card.rank}-${card.suit}`;
    if (selected === key) {
      // Second click confirms the play
      onPlay(card);
      setSelected(null);
    } else {
      setSelected(key);
    }
  }

  return (
    <div className={styles.hand}>
      {cards.map((card) => {
        const key = `${card.rank}-${card.suit}`;
        const isLegal = legalCards ? legalCards.has(key) : false;
        return (
          <Card
            key={key}
            card={card}
            selected={selected === key}
            disabled={!isLegal}
            onClick={() => isLegal && handleClick(card)}
          />
        );
      })}
      {selected && (
        <p className={styles.hint}>Tap again to confirm</p>
      )}
    </div>
  );
}
