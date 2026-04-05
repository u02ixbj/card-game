import React, { useMemo, useState } from 'react';
import WaitingRoom from './WaitingRoom';
import BidPanel from './BidPanel';
import TrickArea from './TrickArea';
import Hand from './Hand';
import ScoreTable from './ScoreTable';
import Card from './Card';
import Chat from './Chat';
import styles from './GameBoard.module.css';

const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

export default function GameBoard({ gameState, error, trickWinner, connectionEvent, messages, actions }) {
  const { phase, players, scores, round, roundIndex, roundSequence, dealerIndex, cohosts, myIndex: myTopIndex } = gameState;

  // Still in lobby
  if (phase === 'lobby') {
    return <WaitingRoom gameState={gameState} actions={actions} error={error} messages={messages} />;
  }

  const { myHand, myIndex, bids, tricksTaken, trumpCard, noTrump, cardsPerPlayer,
    currentTrick, currentBidderIndex, bidOrder, phase: roundPhase } = round;

  const isMyBidTurn = roundPhase === 'bidding' && bidOrder[currentBidderIndex] === myIndex;
  const isDealer = dealerIndex === myIndex;

  // Compute forbidden bid for dealer bust rule
  const forbiddenBid = useMemo(() => {
    if (!isDealer || !isMyBidTurn) return null;
    const otherTotal = bids.reduce((sum, b, i) => i === myIndex ? sum : sum + (b ?? 0), 0);
    const forbidden = cardsPerPlayer - otherTotal;
    return forbidden >= 0 && forbidden <= cardsPerPlayer ? forbidden : null;
  }, [isDealer, isMyBidTurn, bids, myIndex, cardsPerPlayer]);

  // Compute legal cards for playing phase
  const legalCards = useMemo(() => {
    if (roundPhase !== 'playing') return null;
    if (!currentTrick) return null;
    const numPlayers = players.length;
    const expectedPlayer = (currentTrick.leaderIndex + currentTrick.plays.length) % numPlayers;
    if (expectedPlayer !== myIndex) return null;

    const ledSuit = currentTrick.ledSuit;
    if (!ledSuit) return new Set(myHand.map(c => `${c.rank}-${c.suit}`));

    const trumpSuit = noTrump ? null : trumpCard?.suit ?? null;
    const isTrumpLed = trumpSuit && ledSuit === trumpSuit;
    const jokerWasLed = currentTrick.jokerLed ?? false;

    let playable;
    if (isTrumpLed) {
      const trumpCards = myHand.filter(c => c.suit === 'joker' || c.suit === trumpSuit);
      playable = trumpCards.length > 0 ? trumpCards : myHand;
    } else if (jokerWasLed && !trumpSuit) {
      const suitedCards = myHand.filter(c => c.suit === ledSuit);
      const jokersInHand = myHand.filter(c => c.suit === 'joker');
      playable = suitedCards.length > 0 ? [...suitedCards, ...jokersInHand] : myHand;
    } else {
      const suited = myHand.filter(c => c.suit === ledSuit);
      playable = suited.length > 0 ? suited : myHand;
    }
    return new Set(playable.map(c => `${c.rank}-${c.suit}`));
  }, [roundPhase, currentTrick, myHand, myIndex, players.length, noTrump, trumpCard]);

  const [pendingJoker, setPendingJoker] = useState(null);

  function handlePlayCard(card) {
    // No-trump joker lead requires declaring a suit
    if (card.suit === 'joker' && noTrump && !currentTrick?.ledSuit) {
      setPendingJoker(card);
    } else {
      actions.playCard(card);
    }
  }

  const isRoundOver = roundPhase === 'roundOver';
  const isLastRound = roundIndex >= roundSequence.length;
  const totalRounds = roundSequence.length;
  const canAdvance = myTopIndex === 0 || cohosts?.includes(myTopIndex);

  return (
    <div className={styles.board}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.round}>
          Round {Math.min(roundIndex + 1, totalRounds)} / {totalRounds}
          {' '}({cardsPerPlayer} cards)
        </span>
        <span className={styles.trump}>
          {noTrump ? (
            'No Trump'
          ) : trumpCard ? (
            <span className={styles.trumpInner}>
              Trump:
              <span className={styles.trumpCardWrap}>
                <Card card={trumpCard} disabled />
              </span>
            </span>
          ) : null}
        </span>
      </div>

      {/* Score sidebar */}
      <div className={styles.scores}>
        <ScoreTable
          players={players}
          scores={scores}
          bids={bids}
          tricksTaken={tricksTaken}
          activePlayerIndex={
            roundPhase === 'bidding'
              ? bidOrder[currentBidderIndex]
              : roundPhase === 'playing' && currentTrick
                ? (currentTrick.leaderIndex + currentTrick.plays.length) % players.length
                : null
          }
        />
      </div>

      {/* Main play area */}
      <div className={styles.main}>
        {roundPhase === 'bidding' && (
          <BidPanel
            tricksAvailable={cardsPerPlayer}
            forbiddenBid={forbiddenBid}
            isMyTurn={isMyBidTurn}
            onBid={actions.placeBid}
          />
        )}

        {(roundPhase === 'playing' || roundPhase === 'roundOver') && (
          <TrickArea
            trick={currentTrick}
            players={players}
            myIndex={myIndex}
          />
        )}

        {isRoundOver && (
          <div className={styles.roundOver}>
            <h2>Round over!</h2>
            <table className={styles.summary}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Bid</th>
                  <th>Took</th>
                  <th>Result</th>
                  <th>+Pts</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => {
                  const bid = bids[i] ?? 0;
                  const took = tricksTaken[i];
                  const hit = bid === took;
                  const pts = hit ? 10 + (bid * (bid + 1)) / 2 : 0;
                  const diff = took - bid;
                  return (
                    <tr key={i} className={hit ? styles.summaryHit : styles.summaryMiss}>
                      <td>{p.username}</td>
                      <td>{bid}</td>
                      <td>{took}</td>
                      <td>{hit ? '✓' : `${diff > 0 ? '+' : ''}${diff}`}</td>
                      <td>{pts > 0 ? `+${pts}` : '0'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {canAdvance ? (
              <button className="btn-primary" onClick={actions.nextRound}>
                {isLastRound ? 'See final scores' : 'Next round'}
              </button>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                Waiting for host to advance…
              </p>
            )}
          </div>
        )}

        {trickWinner && (
          <div className={styles.trickAnnouncement}>
            <div>{trickWinner.winnerName} wins the trick!</div>
            {trickWinner.card && (
              <div className={styles.trickDetail}>
                {trickWinner.card.rank}{SUIT_SYMBOLS[trickWinner.card.suit]}
                {trickWinner.reason ? ` — ${trickWinner.reason}` : ''}
              </div>
            )}
          </div>
        )}

        {connectionEvent && (
          <div className={`${styles.connectionBanner} ${connectionEvent.connected ? styles.reconnected : styles.disconnected}`}>
            {connectionEvent.connected
              ? `${connectionEvent.username} reconnected`
              : `${connectionEvent.username} disconnected`}
          </div>
        )}

        {error && <p className={`error ${styles.error}`}>{error}</p>}
      </div>

      {/* Player's hand */}
      {roundPhase !== 'roundOver' && (
        <div className={styles.handArea}>
          <Hand
            cards={myHand}
            onPlay={handlePlayCard}
            legalCards={legalCards}
          />
        </div>
      )}

      {/* Chat */}
      <div className={styles.chatArea}>
        <Chat messages={messages} onSend={actions.sendMessage} />
      </div>

      {/* Suit picker — shown when leading a joker in a no-trump round */}
      {pendingJoker && (
        <div className={styles.suitPickerOverlay}>
          <div className={styles.suitPicker}>
            <p>Declare a suit for your joker:</p>
            <div className={styles.suitButtons}>
              {Object.entries(SUIT_SYMBOLS).map(([suit, symbol]) => (
                <button
                  key={suit}
                  className={styles.suitBtn}
                  onClick={() => { actions.playCard(pendingJoker, suit); setPendingJoker(null); }}
                >
                  {symbol} {suit}
                </button>
              ))}
            </div>
            <button className={styles.cancelBtn} onClick={() => setPendingJoker(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
