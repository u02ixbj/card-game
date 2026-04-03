import React from 'react';
import styles from './Card.module.css';

const SUIT_SYMBOLS = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

export default function Card({ card, onClick, selected, disabled, faceDown }) {
  if (faceDown) {
    return <div className={`${styles.card} ${styles.faceDown}`} />;
  }

  const { suit, rank } = card;

  if (suit === 'joker') {
    const label = rank === 'big' ? 'BJ' : 'SJ';
    return (
      <button
        className={`${styles.card} ${styles.joker} ${selected ? styles.selected : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={`${rank} joker`}
      >
        <span className={styles.corner}>{label}</span>
        <span className={styles.suit}>🃏</span>
        <span className={`${styles.corner} ${styles.bottom}`}>{label}</span>
      </button>
    );
  }

  const isRed = RED_SUITS.has(suit);

  return (
    <button
      className={`${styles.card} ${isRed ? styles.red : styles.black} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${rank} of ${suit}`}
    >
      <span className={styles.corner}>{rank}</span>
      <span className={styles.suit}>{SUIT_SYMBOLS[suit]}</span>
      <span className={`${styles.corner} ${styles.bottom}`}>{rank}</span>
    </button>
  );
}
