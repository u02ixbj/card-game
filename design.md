**🃏 Bugger Bridge**

*Project Design & Rules Reference*

Generated: March 29, 2026

**1. Project Overview**

Bugger Bridge is a trick-taking card game app built for personal use
with online multiplayer and solo-vs-AI support. Players bid exactly the
number of tricks they expect to take each round, scoring points only
when their bid is exact.

**Q:** What kind of app?

> **A:** Web app (runs in browser) --- chosen over native mobile for
> faster development and cross-device support without app store
> submissions.

**Q:** Who is this for?

> **A:** Personal use --- just me.

**Q:** Preferred stack?

> **A:** Suggested by Claude --- see Tech Stack section below.

**2. Tech Stack**

  ---------------- --------------------- ---------------------------------
  **Layer**        **Technology**        **Reason**

  Frontend         React                 Great for card game UIs, works on
                                         mobile browsers

  Backend          Node.js + Express     Handles game logic, player
                                         sessions, and rooms

  Real-time        Socket.IO             Instant multiplayer --- players
                                         see each other\'s moves live

  Database         None (to start)       Game state lives in memory;
                                         simple to begin with

  Hosting          Vercel + Railway      Free tiers, beginner-friendly
                                         deployment
  ---------------- --------------------- ---------------------------------

**3. Game Rules**

**3.1 The Deck**

Standard 52-card deck. Card ranking within each suit (high to low):

-   A K Q J 10 9 8 7 6 5 4 3 2

-   Ace is highest, Two is lowest.

-   Trump suit cards beat all non-trump cards regardless of face value.

**3.2 Players**

**Q:** Supported player count?

> **A:** Variable --- 3 to 8 players. Designed primarily around 5
> players.

**3.3 Round Structure**

**Q:** How are rounds structured?

> **A:** Rounds go up from 3 cards per player, reach a peak, then come
> back down. The total number of rounds must always be evenly divisible
> by the number of players so each player deals the same number of
> times. The person who starts the dealing ends the game as the last
> dealer (the game ends when the player to the right of the first dealer
> has dealt).

+-----------------------------------------------------------------------+
| *5-player example: 10 rounds total (3→4→5→6→7→6→5→4→3→4), each player |
| deals twice.*                                                         |
|                                                                       |
| *The round sequence is configurable by the host before the game       |
| starts.*                                                              |
|                                                                       |
| *No-trump rounds appear in the middle --- either just the peak round, |
| or symmetric around the peak.*                                        |
+-----------------------------------------------------------------------+

**3.4 Determining the First Dealer**

-   Deal cards one at a time to each player in turn.

-   The first player to receive a Jack becomes the first dealer.

-   The deal rotates clockwise each round.

**3.5 Trump**

-   After all cards are dealt, flip the top card of the remaining deck
    --- its suit is trump for that round.

-   In no-trump rounds, no suit has special power; the highest card of
    the suit led always wins.

-   The number of no-trump rounds (0, 1, or 2) is configurable before
    the game starts.

-   No-trump rounds are placed in the middle of the game (at or
    symmetric around the peak round).

**3.6 Bidding**

-   Bidding begins with the player to the left of the dealer and
    proceeds clockwise.

-   The dealer bids last.

-   Each player bids any whole number from 0 up to the total number of
    tricks available (= cards dealt per player).

-   Passing is not allowed --- every player must bid.

-   A bid may only be changed before the next player to the left has
    bid.

-   Bidding zero means the player\'s goal is to take no tricks at all.

**Dealer Constraint (the \'Bust\' Rule)**

The dealer\'s bid cannot make the total of all bids equal to the number
of tricks available. This guarantees the round is always \'over-bid\' or
\'under-bid\' --- someone must fail.

**Example:** 5 cards dealt, bids so far total 3 → dealer cannot bid 2.

**3.7 Play of a Trick**

-   The player to the dealer\'s left leads the first card of each round
    (any suit, including trump).

-   Play proceeds clockwise. Each player must follow the suit led if
    possible.

-   If a player cannot follow suit, they may play any card, including
    trump.

-   The trick is won by: the highest trump card played, or if no trump,
    the highest card of the suit led.

-   The winner of a trick leads the next trick.

-   Continue until all cards in the round have been played.

**4. Scoring**

Points are awarded ONLY when a player takes exactly the number of tricks
they bid. There is no penalty for failing to make a bid.

**4.1 Points Table**

Formula: 10 + (bid × (bid + 1)) / 2

  ----------------------- ----------------------- -----------------------
  **Bid**                 **Points Awarded**      **Formula**

  0                       10                      10 + 0

  1                       11                      10 + 1

  2                       13                      10 + 3

  3                       16                      10 + 6

  4                       20                      10 + 10

  5                       25                      10 + 15

  6                       31                      10 + 21

  7                       38                      10 + 28

  8                       46                      10 + 36
  ----------------------- ----------------------- -----------------------

The formula rewards higher bids more generously --- a triangular number
bonus stacks on top of the flat 10 points.

**5. Multiplayer & Lobby**

**Q:** How do players find each other?

> **A:** Host creates a room and shares a 4-letter code. Other players
> join by entering the code and their username.

**Q:** Play modes?

> **A:** Online multiplayer (primary) and solo/group vs. AI opponents.

**Q:** Player identity?

> **A:** Username only for now. Avatar support is on the reminder list
> for a future update.

**6. Future Features & Reminders**

These items were flagged during the design conversation to be added
later:

-   Joker wildcard rules --- discuss how jokers work in no-trump rounds
    and their power level

-   Player avatars --- add avatar selection to the player
    identity/profile system

-   Scoring screen polish --- final scoreboard presentation and game
    history

-   Round structure configurator --- UI for host to set card sequence
    and no-trump round positions

**7. Open Questions / Still To Decide**

-   Round structure defaults for 3, 4, 6, 7, and 8 player counts.

-   AI opponent difficulty levels and bidding strategy.

-   Whether to add a game history / statistics page.

-   Session persistence --- should games survive a page refresh?
