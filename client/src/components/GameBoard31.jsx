import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import Chat from './Chat';
import WaitingRoom from './WaitingRoom';
import styles from './GameBoard31.module.css';

const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const RED_SUITS = new Set(['hearts', 'diamonds']);

function Lives({ count, max = 3 }) {
  return (
    <span className={styles.lives}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < count ? styles.lifeOn : styles.lifeOff}>♥</span>
      ))}
    </span>
  );
}

function EndGameButton({ onEnd }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={styles.endGameBtn}>
      {confirm ? (
        <div className={styles.endGameConfirm}>
          <span>End the game?</span>
          <button className="btn-danger" onClick={() => { onEnd(); setConfirm(false); }}>Yes, end it</button>
          <button className="btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      ) : (
        <button className={styles.endGameTrigger} onClick={() => setConfirm(true)}>✕ End game</button>
      )}
    </div>
  );
}

export default function GameBoard31({ gameState, error, messages, actions }) {
  const { phase, players, myIndex, cohosts, game31 } = gameState;

  // ── All hooks must come before any early return ──
  const [showBlitz, setShowBlitz] = useState(false);
  const [blitzName, setBlitzName] = useState('');
  const [showKnock, setShowKnock] = useState(false);
  const [knockName, setKnockName] = useState('');
  const prevKnocker = useRef(null);

  const g31phase      = game31?.phase;
  const roundResult   = game31?.roundResult;
  const knockerIndex  = game31?.knockerIndex ?? null;

  useEffect(() => {
    if (g31phase === 'roundOver' && roundResult?.blitzerIndex != null) {
      setBlitzName(players[roundResult.blitzerIndex]?.username ?? 'Someone');
      setShowBlitz(true);
      const t = setTimeout(() => setShowBlitz(false), 2800);
      return () => clearTimeout(t);
    }
  }, [g31phase, roundResult?.blitzerIndex]);

  useEffect(() => {
    if (knockerIndex !== null && knockerIndex !== prevKnocker.current) {
      prevKnocker.current = knockerIndex;
      setKnockName(players[knockerIndex]?.username ?? 'Someone');
      setShowKnock(true);
      const t = setTimeout(() => setShowKnock(false), 2500);
      return () => clearTimeout(t);
    }
    if (knockerIndex === null) prevKnocker.current = null;
  }, [knockerIndex]);
  // ── End hooks ──

  if (phase === 'lobby' || !game31) {
    return <WaitingRoom gameState={gameState} actions={actions} error={error} messages={messages} />;
  }

  const {
    roundNumber,
    dealerIndex,
    currentPlayerIndex,
    lives,
    active,
    blitzerIndex,
    stockCount,
    topDiscard,
    myHand,
    myScore,
  } = game31;

  const isMyTurn    = currentPlayerIndex === myIndex;
  const isDrawing   = g31phase === 'drawing' && isMyTurn;
  const isDiscarding = g31phase === 'discarding' && isMyTurn;
  const isRoundOver = g31phase === 'roundOver';
  const canAdvance  = myIndex === 0 || cohosts?.includes(myIndex);

  function statusText() {
    if (isDrawing)    return knockerIndex !== null ? 'Your final turn — draw or take the discard' : 'Your turn — draw, take the discard, or knock';
    if (isDiscarding) return 'Click a card in your hand to discard it';
    if (g31phase === 'drawing' || g31phase === 'discarding') return `Waiting for ${players[currentPlayerIndex]?.username ?? '…'}…`;
    return '';
  }

  return (
    <div className={styles.board}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.roundInfo}>Round {roundNumber}</span>
        <div className={styles.playerLives}>
          {players.map((p, i) => (
            <div
              key={i}
              className={`${styles.playerChip} ${!active[i] ? styles.eliminated : ''} ${i === currentPlayerIndex && !isRoundOver ? styles.activePlayer : ''}`}
            >
              <span className={styles.playerName}>
                {p.username}{i === dealerIndex ? ' D' : ''}{i === myIndex ? ' (you)' : ''}
              </span>
              <Lives count={lives[i]} />
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className={styles.main}>

        {!isRoundOver && (
          <>
            {/* Piles */}
            <div className={styles.piles}>
              <div className={styles.pile}>
                <p className={styles.pileLabel}>Stock ({stockCount})</p>
                {stockCount > 0 ? (
                  <button
                    className={`${styles.pileCard} ${isDrawing ? styles.pileCardClickable : ''}`}
                    onClick={isDrawing ? actions.draw31 : undefined}
                    disabled={!isDrawing}
                    aria-label="Draw from stock"
                  >
                    <Card card={null} faceDown />
                  </button>
                ) : (
                  <div className={styles.emptyPile}>Empty</div>
                )}
              </div>

              <div className={styles.pile}>
                <p className={styles.pileLabel}>Discard</p>
                {topDiscard ? (
                  <button
                    className={`${styles.pileCard} ${isDrawing ? styles.pileCardClickable : ''}`}
                    onClick={isDrawing ? actions.takeDiscard31 : undefined}
                    disabled={!isDrawing}
                    aria-label="Take from discard"
                  >
                    <Card card={topDiscard} />
                  </button>
                ) : (
                  <div className={styles.emptyPile}>Empty</div>
                )}
              </div>
            </div>

            {/* Status + knock button */}
            <div className={styles.actionArea}>
              <p className={styles.statusText}>{statusText()}</p>
              {isDrawing && knockerIndex === null && (
                <button className={`btn-secondary ${styles.knockBtn}`} onClick={actions.knock31}>
                  Knock
                </button>
              )}
            </div>

            {/* Player's hand */}
            <div className={styles.handSection}>
              <p className={styles.handLabel}>
                Your hand{myHand.length === 4 ? ' — pick one to discard' : ''}
                {!isDiscarding && myHand.length === 3 && (
                  <span className={styles.scoreBadge}>{myScore} pts</span>
                )}
              </p>
              <div className={styles.hand}>
                {myHand.map((card, i) => (
                  <div
                    key={`${card.rank}-${card.suit}-${i}`}
                    className={`${styles.handCard} ${isDiscarding ? styles.handCardDiscard : ''}`}
                    onClick={isDiscarding ? () => actions.discard31(card) : undefined}
                  >
                    <Card card={card} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Round over summary */}
        {isRoundOver && roundResult && (
          <div className={styles.roundOver}>
            {roundResult.oneTieAllTie && (
              <div className={styles.oneTieAllTie}>One Tie, All Tie! Everyone's back with 3 lives!</div>
            )}
            {roundResult.blitzerIndex != null && (
              <div className={styles.blitzBanner}>
                💥 {players[roundResult.blitzerIndex]?.username} got 31!
              </div>
            )}
            <h2>Round {roundNumber} Results</h2>
            <table className={styles.summary}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Hand</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>Lives</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => {
                  if (!roundResult.hands[i] || roundResult.hands[i].length === 0) return null;
                  const hand = roundResult.hands[i];
                  const score = roundResult.scores[i];
                  const isBlitzer = roundResult.blitzerIndex === i;
                  const lost = isBlitzer
                    ? false
                    : roundResult.blitzerIndex != null
                      ? active[i]
                      : roundResult.loserIndices.includes(i);
                  return (
                    <tr key={i} className={isBlitzer ? styles.summaryBlitz : lost ? styles.summaryLost : styles.summaryOk}>
                      <td>{p.username}{i === myIndex ? ' (you)' : ''}</td>
                      <td className={styles.handCells}>
                        {hand.map((c, j) => (
                          <span key={j} className={`${styles.inlineCard} ${RED_SUITS.has(c.suit) ? styles.red : styles.black}`}>
                            {c.rank}{SUIT_SYMBOLS[c.suit]}
                          </span>
                        ))}
                      </td>
                      <td>{score}</td>
                      <td>{isBlitzer ? '💥 31!' : lost ? '-♥' : '✓'}</td>
                      <td><Lives count={roundResult.livesAfter[i]} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {canAdvance ? (
              <button className="btn-primary" onClick={actions.nextRound}>Next Round</button>
            ) : (
              <p className={styles.waiting}>Waiting for host to continue…</p>
            )}
          </div>
        )}

        {error && <p className={`error ${styles.error}`}>{error}</p>}
      </div>

      {/* Chat */}
      <div className={styles.chatArea}>
        <Chat messages={messages} onSend={actions.sendMessage} />
      </div>

      {/* Blitz overlay */}
      {showBlitz && (
        <div className={styles.blitzOverlay}>
          <div className={styles.blitzContent}>
            <div className={styles.blitzTitle}>💥 BLITZ!</div>
            <div className={styles.blitzSub}>{blitzName} hit 31!</div>
          </div>
        </div>
      )}

      {/* Knock announcement */}
      {showKnock && (
        <div className={styles.knockAnnouncement}>
          🤜 {knockName} knocked! One last turn each.
        </div>
      )}

      {/* End game button — host only */}
      {myIndex === 0 && !isRoundOver && <EndGameButton onEnd={actions.endGame} />}
    </div>
  );
}
