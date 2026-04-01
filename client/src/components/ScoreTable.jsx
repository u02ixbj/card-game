import React from 'react';
import styles from './ScoreTable.module.css';

export default function ScoreTable({ players, scores, bids, tricksTaken }) {
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
          return (
            <tr key={i} className={hit ? styles.hit : ''}>
              <td>{p.username}</td>
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
