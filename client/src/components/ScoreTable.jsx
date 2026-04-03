import React from 'react';
import styles from './ScoreTable.module.css';

export default function ScoreTable({ players, scores, bids, tricksTaken, activePlayerIndex }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Player</th>
          {bids && <th>Bid</th>}
          {tricksTaken && <th>Took</th>}
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p, i) => {
          const hit = bids && tricksTaken && bids[i] === tricksTaken[i];
          const isActive = activePlayerIndex === i;
          const rowClass = [hit ? styles.hit : '', isActive ? styles.active : ''].filter(Boolean).join(' ');
          return (
            <tr key={i} className={rowClass}>
              <td>
                {isActive && <span className={styles.pulse} aria-hidden="true" />}
                {!p.connected && <span className={styles.offline} title="Disconnected">●</span>}
                {p.username}
              </td>
              {bids && <td>{bids[i] ?? '—'}</td>}
              {tricksTaken && <td>{tricksTaken[i]}</td>}
              <td>{scores[i]}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
