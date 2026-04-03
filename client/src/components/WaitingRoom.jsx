import React, { useState, useEffect } from 'react';
import { generateRoundSequence, autoPeak } from '../utils/gameUtils';
import Chat from './Chat';
import styles from './WaitingRoom.module.css';

export default function WaitingRoom({ gameState, actions, error, messages }) {
  const { code, players, config, myIndex, cohosts } = gameState;
  const isHost = myIndex === 0;

  // Local state keeps inputs responsive; syncs from server config on change
  const [peakAuto, setPeakAuto] = useState(config.peakCards === null);
  const [localMinCards, setLocalMinCards] = useState(String(config.minCards));
  const [localPeakCards, setLocalPeakCards] = useState(String(config.peakCards ?? autoPeak(players.length)));

  // Keep local inputs in sync if config changes from server (e.g. after reconnect)
  useEffect(() => { setLocalMinCards(String(config.minCards)); }, [config.minCards]);
  useEffect(() => {
    if (config.peakCards !== null) setLocalPeakCards(String(config.peakCards));
  }, [config.peakCards]);

  const numPlayers = players.length;
  const resolvedPeak = peakAuto ? autoPeak(numPlayers) : (parseInt(localPeakCards, 10) || autoPeak(numPlayers));

  const preview = generateRoundSequence(
    numPlayers,
    peakAuto ? null : (parseInt(localPeakCards, 10) || null),
    config.noTrumpRounds,
    parseInt(localMinCards, 10) || config.minCards,
  );

  function handlePeakAutoChange(e) {
    const auto = e.target.checked;
    setPeakAuto(auto);
    actions.updateConfig({ peakCards: auto ? null : (parseInt(localPeakCards, 10) || autoPeak(numPlayers)) });
  }

  function handlePeakInput(e) {
    const raw = e.target.value;
    setLocalPeakCards(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= 52) {
      actions.updateConfig({ peakCards: n });
    }
  }

  function handleMinCards(e) {
    const raw = e.target.value;
    setLocalMinCards(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) {
      actions.updateConfig({ minCards: n });
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.chatPanel}>
        <Chat messages={messages} onSend={actions.sendMessage} />
      </div>
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
                  <span style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      onClick={() => actions.setCohost(i, !isCohost)}
                    >
                      {isCohost ? 'Remove co-host' : 'Co-host'}
                    </button>
                    <button
                      className="btn-danger"
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      onClick={() => actions.kickPlayer(i)}
                    >
                      Kick
                    </button>
                  </span>
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
                value={localMinCards}
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
                    min={1}
                    max={52}
                    value={localPeakCards}
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

          <div className={styles.configRow}>
            <span>Use jokers</span>
            {isHost ? (
              <input
                type="checkbox"
                checked={config.useJokers ?? false}
                onChange={e => actions.updateConfig({ useJokers: e.target.checked })}
              />
            ) : (
              <span className={styles.readOnly}>{config.useJokers ? 'Yes' : 'No'}</span>
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
          disabled={!isHost || players.filter(p => p.connected).length < 2}
        >
          Start Game
        </button>
        {!isHost && <p className={styles.hint}>Waiting for host to start…</p>}
        {isHost && players.filter(p => p.connected).length < 2 && (
          <p className="error">Need at least 2 players</p>
        )}
        {error && <p className="error">{error}</p>}
        <p style={{ fontSize: '0.7rem', opacity: 0.3, marginTop: '1rem' }}>v1.1</p>
      </div>
    </div>
  );
}
