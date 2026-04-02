import React, { useState } from 'react';
import { generateRoundSequence, autoPeak } from '../utils/gameUtils';
import styles from './WaitingRoom.module.css';

export default function WaitingRoom({ gameState, actions }) {
  const { code, players, config, myIndex, cohosts } = gameState;
  const isHost = myIndex === 0;

  // Local state for the peak-cards field — tracks the text input value separately
  // so the user can type freely before committing.
  const [peakInput, setPeakInput] = useState('');
  const [peakAuto, setPeakAuto] = useState(config.peakCards === null);

  const numPlayers = players.length;
  const resolvedPeak = peakAuto ? autoPeak(numPlayers) : (config.peakCards ?? autoPeak(numPlayers));

  const preview = generateRoundSequence(
    numPlayers,
    peakAuto ? null : config.peakCards,
    config.noTrumpRounds,
    config.minCards,
  );

  function handlePeakAutoChange(e) {
    const auto = e.target.checked;
    setPeakAuto(auto);
    actions.updateConfig({ peakCards: auto ? null : resolvedPeak });
  }

  function handlePeakInput(e) {
    const raw = e.target.value;
    setPeakInput(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= config.minCards && n <= 52) {
      actions.updateConfig({ peakCards: n });
    }
  }

  function handleMinCards(e) {
    const n = parseInt(e.target.value, 10);
    if (!isNaN(n) && n >= 1 && n <= resolvedPeak) {
      actions.updateConfig({ minCards: n });
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h2>Room <span className={styles.code}>{code}</span></h2>
        <p className={styles.hint}>Share this code with other players</p>

        <ul className={styles.playerList}>
          {players.map((p, i) => {
            const isCohost = cohosts?.includes(i);
            return (
              <li key={i} className={`${styles.playerRow} ${p.connected ? '' : styles.disconnected}`}>
                <span>
                  {p.username}
                  {i === 0 && <span className={styles.crown}> (host)</span>}
                  {isCohost && <span className={styles.crown}> (co-host)</span>}
                  {i === myIndex && <span className={styles.you}> (you)</span>}
                  {!p.connected && <span className={styles.dc}> disconnected</span>}
                </span>
                {isHost && i !== 0 && (
                  <button
                    className={isCohost ? 'btn-secondary' : 'btn-secondary'}
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={() => actions.setCohost(i, !isCohost)}
                  >
                    {isCohost ? 'Remove co-host' : 'Make co-host'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className={styles.count}>{players.length} / 8 players</p>

        <div className={styles.config}>
          <h3>Game Settings</h3>

          <div className={styles.configRow}>
            <span>Min cards per round</span>
            {isHost ? (
              <input
                type="number"
                min={1}
                max={resolvedPeak}
                value={config.minCards}
                onChange={handleMinCards}
                className={styles.numInput}
              />
            ) : (
              <span className={styles.readOnly}>{config.minCards}</span>
            )}
          </div>

          <div className={styles.configRow}>
            <span>Peak cards per round</span>
            {isHost ? (
              <span className={styles.peakControl}>
                <label className={styles.autoLabel}>
                  <input
                    type="checkbox"
                    checked={peakAuto}
                    onChange={handlePeakAutoChange}
                  />
                  auto ({autoPeak(numPlayers)})
                </label>
                {!peakAuto && (
                  <input
                    type="number"
                    min={config.minCards}
                    max={52}
                    value={peakInput || config.peakCards || autoPeak(numPlayers)}
                    onChange={handlePeakInput}
                    className={styles.numInput}
                  />
                )}
              </span>
            ) : (
              <span className={styles.readOnly}>
                {config.peakCards ?? `auto (${autoPeak(numPlayers)})`}
              </span>
            )}
          </div>

          <div className={styles.configRow}>
            <span>No-trump rounds</span>
            {isHost ? (
              <select
                value={config.noTrumpRounds}
                onChange={e => actions.updateConfig({ noTrumpRounds: Number(e.target.value) })}
                className={styles.select}
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            ) : (
              <span className={styles.readOnly}>{config.noTrumpRounds}</span>
            )}
          </div>
        </div>

        {preview.length > 0 && (
          <div className={styles.preview}>
            <p className={styles.previewLabel}>
              Round sequence — {preview.length} rounds, peak {resolvedPeak} cards
            </p>
            <div className={styles.sequence}>
              {preview.map((r, i) => (
                <span
                  key={i}
                  className={`${styles.pill} ${r.noTrump ? styles.pillNT : ''} ${r.cardsPerPlayer === resolvedPeak ? styles.pillPeak : ''}`}
                  title={r.noTrump ? 'No trump' : ''}
                >
                  {r.cardsPerPlayer}
                  {r.noTrump ? <sup>NT</sup> : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn-primary"
          onClick={actions.startGame}
          disabled={!isHost || players.filter(p => p.connected).length < 3}
        >
          Start Game
        </button>
        {!isHost && <p className={styles.hint}>Waiting for host to start…</p>}
        {isHost && players.filter(p => p.connected).length < 3 && (
          <p className="error">Need at least 3 players</p>
        )}
      </div>
    </div>
  );
}
