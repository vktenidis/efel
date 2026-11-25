create extension if not exists pg_cron;
-- Πρώτα: Database → Extensions → ενεργοποίησε το pg_cron. Μετά τρέξε:
select cron.schedule('efel-tick', '*/15 * * * *', $$select public.efel_tick()$$);

-- Ζωντανές ενημερώσεις στη σελίδα (Realtime)
alter publication supabase_realtime add table clubs, roster, matches, offers, news, bid_rounds, config, club_managers;
