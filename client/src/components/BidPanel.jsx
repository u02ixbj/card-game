import React, { useState } from 'react';
import styles from './BidPanel.module.css';

/**
 * Shown during the bidding phase for the active bidder.
 *
 * `tricksAvailable`  — max allowed bid
 * `forbiddenBid`     — if set (dealer bust rule), this bid value is disabled
 * `isMyTurn`         — whether the local player should be bidding now
 */
export default function BidPanel({ tricksAvailable, forbiddenBid, isMyTurn, onBid }) {
  const [selected, setSelected] = useState(null);

  const bids = Array.from({ length: tricksAvailable + 1 }, (_, i) => i);

  function handleSubmit() {
    if (selected !== null) {
      onBid(selected);
      setSelected(null);
    }
  }

  if (!isMyTurn) {
    return <div className={styles.waiting}>Waiting for other players to bid…</div>;
  }

  return (
    <div className={styles.panel}>
      <p className={styles.label}>Your bid</p>
      <div className={styles.bids}>
        {bids.map(b => (
          <button
            key={b}
            className={`${styles.bidBtn} ${selected === b ? styles.active : ''}`}
            disabled={b === forbiddenBid}
            onClick={() => setSelected(b)}
            title={b === forbiddenBid ? "Dealer can't bid this (bust rule)" : undefined}
          >
            {b}
          </button>
        ))}
      </div>
      <button
        className={`btn-primary ${styles.confirm}`}
        disabled={selected === null}
        onClick={handleSubmit}
      >
        Confirm bid
      </button>
    </div>
  );
}
