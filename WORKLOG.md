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
