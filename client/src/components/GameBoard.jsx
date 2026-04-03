import React, { useMemo } from 'react';
import WaitingRoom from './WaitingRoom';
import BidPanel from './BidPanel';
import TrickArea from './TrickArea';
import Hand from './Hand';
import ScoreTable from './ScoreTable';
import styles from './GameBoard.module.css';

const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

export default function GameBoard({ gameState, error, trickWinner, actions }) {
  const { phase, players, scores, round, roundIndex, roundSequence, dealerIndex, cohosts, myIndex: myTopIndex } = gameState;

  // Still in lobby
  if (phase === 'lobby') {
    return <WaitingRoom gameState={gameState} actions={actions} error={error} />;
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

    const suited = myHand.filter(c => c.suit === ledSuit);
    const playable = suited.length > 0 ? suited : myHand;
    return new Set(playable.map(c => `${c.rank}-${c.suit}`));
  }, [roundPhase, currentTrick, myHand, myIndex, players.length]);

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
          {noTrump
            ? 'No Trump'
            : trumpCard
              ? `Trump: ${SUIT_SYMBOLS[trumpCard.suit]} ${trumpCard.suit}`
              : ''}
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
            {trickWinner} wins the trick!
          </div>
        )}

        {error && <p className={`error ${styles.error}`}>{error}</p>}
      </div>

      {/* Player's hand */}
      {roundPhase !== 'roundOver' && (
        <div className={styles.handArea}>
          <Hand
            cards={myHand}
            onPlay={actions.playCard}
            legalCards={legalCards}
          />
        </div>
      )}
    </div>
  );
}
