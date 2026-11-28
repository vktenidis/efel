# EFEL · Calendar and club progression

## 27 November 2026 · Starting point

Branch upgrade/calendar-club-progression starts at b72da01 (efel-prod06). Production contains the 09–11 friendly, appearances, sanctions, roster and fair-market upgrades. Read these before changing any financial or fixture RPC.

### Planned work, recorded before implementation

1. Trace the scheduling controls through both the match modal and main calendar. Use one proposed time, keep existing multi-time invites answerable, and provide invitations from a selected day.
2. Build availability and private manager communication around existing match and friendly records. Verify participant access, optional messages and responses with isolated accounts.
3. Count confirmed friendlies for relationships, opponent variety and fan progress. Verify the rolling weekly payment caps of eight per club and three per opponent independently from activity recognition.
4. Model a gentler three-season euro economy. Reserve a modest salary for ordinary players and a visibly higher salary for elite players. Check champion and active mid-table routes to a marquee signing. Check stable identities, verified max rating, actual GP costs and existing ownership before any production conversion.
5. Record actual files, commits, test results, release status and data gaps here as work progresses.

Existing evidence: standard.json rows contain a card ID, name, position, rating and artwork index. The rating field alone does not establish a trained MAX OVR. Keep the live GP ledger intact while evaluating conversion.

## Implemented on the release branch

The first commit d3c9dbb contains the plan alone. The baseline b72da01 remains a recoverable frontend checkpoint.

- app.js, assets/ui/v5.css, index.html and sw.js implement efel-prod07. The match action now opens a single-time editor directly in the visible modal. All calendar dates open, including dates without fixtures. Managers can publish/remove availability intervals, select a day or opponent, invite to a friendly or an existing open fixture, and accept or counter a proposal. Existing multi-time proposals remain answerable. Date inputs and calendar markers use the browser's local time zone and database timestamps carry offsets.
- supabase/migrations/20261127103836_calendar_club_activity.sql adds manager availability, participant-only private messages, two invoker RPCs for invitations with optional messages and a confirmed-match aggregate. A failed note rolls back the associated proposal. New reciprocal friendly requests share a transaction lock. In Messages, managers can open a contact, read the latest 50 messages, refresh and reply. No message content is copied to league news.
- The migration changes friendly limits to eight paid per club and three per pair over the existing rolling seven-day window. The live fee and win bonus retain their configured GP values. Each finalized friendly contributes one fan to each club regardless of payout. Pair badges unlock at 5/10/30. Opponent-variety badges unlock at 3/5. Counts come from finalized database records, independent of the recent-news cutoff.
- tools/review-ratings.py checks the exact card ID on PESDB, standard category, name, position and base rating. assets/verified-ratings.json contains ten verified cards. Mbappé is 85 base / 95 MAX. Salah's two versions peak at 93 and 92. Son's peak at 89 and 83. Both market lists prefer the highest verified MAX for a group only if every version in that group has been verified. Owned variants, a manager's bids, and shortlisted variants remain accessible. Legacy transactions and server-side ownership still use card IDs. The source rate-limited subsequent checks. See each JSON record for its reference.
- The administration screen provides a working three-season euro simulator using assets/ui/economy-model.js. The active schedule is 14 rounds spaced three days apart. At six modeled weeks per season the champion playing six paid friendlies per week can fund a €200m signing and €6m salary after season two, including the existing squad's next payroll. Fourth place with eight per week can do so after season three. The model assumes repeated placings, full season completion and no gains from player sales. Optional 82 MAX purchases cost €35m with a €2m seasonal wage each.

### Verification

- tests/calendar-db.cjs loads repository SQL 01–03 and 06–11 plus the new migration into isolated PostgreSQL with synthetic users and clubs. It covers both invite types, acceptance, participant-only message reads, availability ownership, payout caps and activity totals. Sixteen confirmed friendlies produced eight paid matches for the tested club, with all sixteen counting towards relationships.
- tests/calendar-postgres.cjs additionally runs 40 simultaneous authenticated reads and competing reciprocal friendly requests against a disposable PostgreSQL 17 server. Only one invitation was created. Run with node tests/calendar-db.cjs --postgres with embedded-postgres and pg installed, or run the default test with @electric-sql/pglite.
- tests/browser.cjs checks 12 manager routes at 360, 390, 430, 768, 1024, 1440 and 1920 px using isolated Supabase fixtures. It exercises the modal, calendar invitations, availability, messages, verified MAX, canonical Son entry and simulator as well as existing auction, transfer, score and auth UI checks. tests/economy.cjs validates three seasonal paths and the opening budget arithmetic.
- Browser screenshots use synthetic QA data. [Mobile calendar](docs/calendar/calendar-390.png) and [desktop calendar](docs/calendar/calendar-1440.png).

### Handoff for the next contributor

The euro simulator is a preview. The active ledger, contracts, bids, offers, transfers, squad eligibility and prices still use the established GP rules. The 200-to-1 example is a design anchor. This release did not establish official GP acquisition prices for the catalogue. Obtain verified bulk card/price data, measure the pool below 70 MAX by position, reconcile existing ownership and commitments, and validate an explicit season-boundary conversion including NPC budgets before activating euros or retiring IDs in the database. The prototype reserves next-season salaries when assessing affordability. It does not charge clubs.

Mid-season and final fan awards, archived winners, read receipts, push messaging and full-catalogue MAX coverage are not part of this release. Threads currently load the latest 50 messages; old messages remain in the database. New proposals from this release use one time. Prior clients can still use the legacy scheduling RPCs. The SQL tests use fixtures and production verification is read-only apart from the release migration itself.

### Production release record

Release implementation commit 087beb73451f66d11975f7e6e7504b7f0c65b0df. [PR #5 and its integration status](https://github.com/vktenidis/efel/pull/5). [GitHub Pages deployment history](https://github.com/vktenidis/efel/deployments/github-pages). [Production website](https://vktenidis.github.io/efel/).

Applied the calendar_club_activity migration to the connected EFEL Supabase project. Read-only verification found both new tables enforcing RLS, five policies, both new RPCs executing with caller privileges, and anonymous roles excluded from private messages and invitations. Live payment settings were confirmed as 8/3, participation 1,500 GP and win bonus 500 GP. No production match, invitation, message, roster, balance or payout was created for testing. The post-migration security advisor returned no finding naming a new calendar object. For frontend deployment verification compare the published app.js and index.html to this release; the cache marker is efel-prod07.

## Euro equivalents and player presentation · 27 November 2026

Starting from f4c2f1c. Add display equivalents using the requested eFootball GP anchor, audit the price inputs actually present, correct the office league-position suffix, integrate player photography into cards and check the published UI at mobile and desktop sizes. Keep all financial actions in the current EFEL unit and distinguish verified reference values from estimates.

### Release efel-prod08

The display anchor is €200 per eFootball GP. With the active conversion setting of three eFootball GP per EFEL GP, an offer of 65,000 EFEL GP displays as €39 million. The club office, budget, catalogue, cards and transfer screens show the equivalent. Offer fields still accept EFEL GP, update their euro preview as the manager types and submit the original GP amount. No SQL or financial rule changed in this release.

The club office has a locally optimized original tunnel photograph and more spacing between the league rank and ordinal suffix. The player card combines a portrait, rating, position, value and ownership crest on one surface. Original art and photo credits are available in player details. Fourteen credited Commons photographs were added, including Neymar Jr, Jack Grealish, João Cancelo and Dominic Solanke. Portrait coverage increased from 115 to 129 card IDs (100 to 114 footballer IDs). Across the 19,254-card catalogue, 776 cards have direct artwork and 819 have at least one identified image, up from 811. Manager-league rosters have 87 of 199 cards with an identified image. The dated roster snapshot and methodology are reflected in media-coverage.json.

The catalogue and seed agree on all 19,254 IDs, names, positions, base ratings and artwork indexes. All seed prices are 5,000 GP. A read-only check of the live player table found 16 different EFEL prices and no column for a sourced in-game GP acquisition price. Current eFootball estimates come from base OVR brackets. No complete official GP list was verified or imported.

There are now 337 verified MAX ratings, previously ten. New records use the original artwork index and the matching printed base value. Cards without a legible matching value retain base OVR unless an independent card-specific source verifies MAX. A total of 18,917 still need a MAX source. Of 1,094 candidate multi-version groups sharing a base identity and name, three have complete MAX evidence. The market can hide three secondary variants, with exceptions for ownership, bids and shortlists. Existing card IDs remain intact.

[Download the card-ID handoff CSV (gzip)](docs/catalogue/standard-review.csv.gz). It includes all cards, current MAX evidence and empty columns for verified in-game GP and its source. Use the exact card_id for matching, and keep version-specific evidence. Regenerate with `python tools/audit-standard.py --export standard-review.csv`. Author, licence and modification details for the new photographs are in assets/media.json.

Playwright passed 12 manager routes at 360, 390, 430, 768, 1024, 1440 and 1920 px. The browser measured a positive gap between the numeral and suffix at each width. It decoded an added local photograph, displayed 65,000 GP as €39m, updated the preview to €36m for 60,000 GP and asserted that the transfer requested 60,000 GP. Other isolated flows include bids, scores, scheduling, private messages and admin gating. JavaScript syntax, economy scenarios, catalogue reconciliation and image decoding also passed. Screenshots use test clubs and budgets.

[Mobile office](docs/matchday/home-390.webp) · [Desktop office](docs/matchday/home-1440.webp) · [Mobile player details](docs/matchday/player-390.webp)

## Euro transactions and navigation · 27 November 2026

Baseline b4e3873. Audit manager-facing currency entry, confirmation and settlement. Introduce exact euro entry with validation against the league's existing settlement precision, review navigation groups and mobile access, expand licensed portraits, test financial requests on fixtures and check the published build.

### Release efel-prod09

Managers enter euros for sealed bids, transfer proposals and counters. The confirmation, offer history, fees, balances, admin budgets, prizes and friendly payouts use the league's euro denomination. Market price filters take millions of euros. One historical accounting unit settles exactly €600. This rate is fixed independently of the card-pricing configuration. With the existing integer ledger, €600 is the smallest settlement step. Unsupported amounts are rejected before submission and in the euro RPCs. Existing clients, pending bids, rosters, balances and audit records keep their original accounting units.

The additive euro_transactions migration adds three caller-privilege euro RPCs and a checked numeric conversion. It delegates settlement, locks, permissions and competition checks to the existing routines. Its production verification checked the four functions, denied anonymous execute, authenticated grants and the exact read-only conversion of €39,000,600 to 65,001 units. The security advisor returned no entry naming the new functions. No production transaction or balance change was used for QA.

The phone navigation has five primary destinations. The Menu groups club operations, competition and account actions, with direct access to the formation, finances, messages and role-gated administration. Desktop users can use the same directory. The office allows long club names to wrap. Local photography increased from 129 to 144 mapped card IDs and from 114 to 128 identified players. Fourteen additional optimized, attributed photographs include Haaland, Kane, Vinícius Júnior and Neuer. One rear-view image was excluded from this and future imports of that photograph.

Player details show the league price in euros and the current Standard GP price from PES Master where available. The price review checked the player's card ID, name, position, Standard category, GP field and visible price. There are 210 sourced current prices, including all 199 cards in the manager-league roster snapshot. The source reports a different base rating for all 210. Details distinguish the source OVR from the catalogue OVR and link to the dated quote. The other 19,044 cards use a labeled base-OVR estimate when configured. Neither verified MAX records nor league prices were derived from these quotes. The matching CSV distinguishes a current Standard quote from an exact historical quote. Run tools/review-standard-prices.py with explicit card IDs to refresh selected records.

The isolated database test covers an actual euro bid, proposal, counter, acceptance, both wallet deltas and ownership. It rejects fractional, out-of-step, negative, null and overflowing amounts, and denies anonymous access. PostgreSQL 17 also passed the existing 40-reader and reciprocal-invitation tests. Browser QA uses fixtures at 360, 390, 430, 768, 1024, 1440 and 1920 px. Production smoke tests are signed out.

[Mobile menu](docs/euro/menu-390.webp) · [Desktop menu](docs/euro/menu-1440.webp) · [Player details and sourced GP](docs/euro/player-390.webp) · [Updated card-ID handoff](docs/catalogue/standard-review.csv.gz)

## Manager office and club match history · 28 November 2026

Baseline 19ab084. Compress office alerts into actionable symbols and short labels, make the week and budget tiles fully clickable, improve supporter contrast and friendly help, and show top squad market values plus dated, crested scorelines. Verify at phone and desktop widths before publication.

### Release efel-prod10

The manager office now renders short alerts with symbols for contract expiries, missing managers, pre-agreements, positional cover, lineups, offers and scheduling. The contract badge reflects the current count. Unmanaged opponents display their crest and a suited manager with a red cross. Existing actions for accepting a result or activating a player remain explicit.

The entire week and budget panels open their analyses with a pointer or keyboard. Both the weekly summary and detail include renewal costs. Raised edges and restrained gradients distinguish actionable tiles. The mobile modal sits above the fixed navigation.

Club profiles list the five highest current EFEL market values, with deterministic tie-breaks. The roster valuation sums those market values. Each scoreline shows home and away crests and the home-first score, with the latest dated results first on the profile. The app stores agreed kickoff and result events, without a dedicated played-at timestamp. The date label identifies agreed kickoff, finalization, or the last score update. Unknown dates remain explicit.

The fan button pairs a high-contrast count and meter with a crowd icon. Tapping it opens the explanation, current opponents and badges. Friendly payouts and weekly limits have a separate help bubble with live configuration. Bubbles support closing by button, outside click and Escape.

Playwright passed 12 manager routes at seven widths from 360 to 1920 px. At 390 and 1440 px it also exercised mouse and keyboard tile activation, the 13-contract fixture, manager vacancy icon, price-based ranking, two-crested away scoreline, timestamp fallback and fan/friendly bubbles. The popover stayed within the viewport and Escape left the underlying club dialog open. Fixtures were isolated. JavaScript syntax and the existing three-season economy tests passed. No database migration required.

[Office alerts](docs/office/office-alerts-390.webp) · [Club profile](docs/office/club-390.webp) · [Friendly help](docs/office/friendly-help-390.webp)

## Navigation directory refinement · efel-prod11

Starting from c2db00f, refined the full menu with clearer group headings, higher-contrast labels, subtle photographic backgrounds and raised touch surfaces. Added visible keyboard focus and reduced-motion support. Existing destinations, role checks and actions are retained. Playwright passed 12 manager routes at 360, 390, 430, 768, 1024, 1440 and 1920 px, including the menu-to-calendar transition, mobile navigation and admin gating. The font inheritance adjustment was inspected alongside the menu layout. Subsequent sections remain available for separate, complete upgrades.

## Club workspace refinement · efel-prod12

Starting from 37a2f36, refreshed the club header, surfaces, squad rows and seven-section navigation. Selected tabs now expose their state to assistive technology. On narrow screens, financial statistics and tab buttons use two columns for readability. Playwright traversed all seven tabs at 360, 390, 430, 768, 1024, 1440 and 1920 px and checked selection and horizontal overflow. The broader twelve-route suite and existing action tests passed. No database changes.

## Market workspace refinement · efel-prod13

Starting from ad8226d, refined the catalogue surface, search controls, filters, result rows and card-view selection. Empty searches now explain how to clear filters. View toggles expose their pressed state and keyboard focus is visible. Playwright passed twelve routes at 360–1920 px and verified search, empty results, reset, card/list switching, player details, pagination and an isolated bid. No database changes.

## Calendar and matchday refinement · efel-prod14

Starting from 6d97981, refreshed calendar days, month navigation, matchday selector, match rows and friendly panels. Added accessible names to month navigation and visible keyboard focus. The browser suite passed at 360, 390, 430, 768, 1024, 1440 and 1920 px. It checked next/previous month, calendar invitations, friendly invitations, match result submission and the existing twelve manager routes with fixtures. No database changes.

## Standings and club directory refinement · efel-prod15

Starting from 2b8ac8d, refined the standings table and club directory surfaces, row contrast, club-colour headers and keyboard focus. The horizontally scrollable standings region now has an accessible name and can receive keyboard focus. Playwright passed twelve routes at seven widths from 360 to 1920 px and opened club profiles from both standings and the club directory. No database changes.

## Mobile standings correction · efel-prod16

Starting from 7c6a36c, aligned each club crest with its name and restored all statistics to the horizontally scrollable mobile table. A visible hint explains the gesture. Playwright checked logo/name geometry, horizontal scrolling and club-profile opening at 360, 390 and 430 px, plus the twelve-route suite through 1920 px. No database changes.

## Mobile office fitting · efel-prod17

Starting from d34bb30, the weekly summary and lineup each occupy a full mobile row. Weekly amounts can wrap within their tile, and the PES and portrait lineup views have more room. Browser QA checked widths 360, 390 and 430 px, both pitch modes, an eleven-player fixture and a long monetary value. The twelve-route suite passed through 1920 px. No database changes.

## Transfer desk and league paper refinement · efel-prod18

Starting from f747f96, refined transfer scouting rows, offer surfaces, window status and input focus. Adjusted the newspaper header and close control for mobile. Playwright passed twelve routes at seven widths, including transfer search, offer and counter-offer fixtures. A populated newspaper fixture was opened and closed at 390 and 1440 px with no document overflow. No database changes.

## Newspaper and rules refinement · efel-prod19

Starting from 647aab0, redesigned the league newspaper with warm paper colour, fine texture, serif headlines, double rules and a single-column mobile reading layout. Refined the rules reading surface and search focus. Playwright passed twelve routes at seven widths, including rules search/reset and a populated newspaper opened and closed at 390 and 1440 px. No database changes.

## Messages and manager profile refinement · efel-prod20

Starting from c8451c2, refined contact rows, conversation messages, the message editor and manager profile statistics. On narrow screens, profile statistics use two columns and long text can wrap. Playwright passed twelve routes at seven widths, opened manager profiles without dialog overflow and sent a message using isolated fixtures. No database changes.

## Sign-in and organiser workspace refinement · efel-prod21

Starting from cb0b041, refined the sign-in surface and organiser form contrast, touch targets and mobile sizing. Playwright passed twelve routes at seven widths, verified sign-in wiring and role-gated administration, and checked the admin screen at 390 px without document overflow. Configuration actions used isolated fixtures. No database changes.

## Player and transaction dialogs · efel-prod22

Starting from 5d6c207, refined player detail and transaction confirmation surfaces, keyboard focus, value wrapping and mobile amount fitting. Playwright passed twelve routes at seven widths, checked player values and a transfer confirmation using isolated fixtures. No database changes.

## Match and notification dialogs · efel-prod23

Starting from fbdd554, refined match and notification dialog surfaces, team-name wrapping, score presentation, touch targets and keyboard focus. Playwright passed twelve routes at seven widths, opening notifications and a match dialog without horizontal overflow. The existing scheduling, friendly and result fixture flows passed. No database changes.
