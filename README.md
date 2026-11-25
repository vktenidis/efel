# EFEL · eFootball Evolution League

Ζωντανή λίγκα σε στιλ Master League. Τρεις λίγκες: **EFEL Premier** (managers) και δύο αυτόματες (**Europa**, **Classic**) που παίζουν μόνες τους. Κάθε παίκτης ανήκει σε έναν σύλλογο σε όλο τον κόσμο.

- `web/`: η σελίδα (GitHub Pages). Δεν έχει κανένα μυστικό.
- `supabase/`: η βάση και όλοι οι κανόνες. Κάθε κίνηση (αγορά, προσφορά, σκορ, ενεργοποίηση) ελέγχεται στον server.

## Εγκατάσταση (περίπου 30 λεπτά, μία φορά)

### 1. Supabase
1. Φτιάξε δωρεάν λογαριασμό στο supabase.com → **New project** (περιοχή: Frankfurt).
2. **SQL Editor** → τρέξε με τη σειρά: `01_schema.sql`, `02_functions.sql`, `03_world.sql`.
3. **Database → Extensions** → ενεργοποίησε το `pg_cron`. Μετά τρέξε το `04_cron.sql` (ρολόι κάθε 15 λεπτά + ζωντανές ενημερώσεις).
4. **Table Editor → players → Insert → Import data from CSV** → `players.csv` (19.254 standard κάρτες).

### 2. Είσοδος με Google
1. Στο Google Cloud Console φτιάξε **OAuth client ID** (Web application). Στο *Authorized redirect URIs* βάλε `https://<project>.supabase.co/auth/v1/callback`.
2. Supabase → **Authentication → Providers → Google**: βάλε Client ID και Secret.
3. Supabase → **Authentication → URL Configuration**: *Site URL* η διεύθυνση της σελίδας (π.χ. `https://efel.gr` ή `https://<user>.github.io/efel/`).

### 3. Η σελίδα
1. Συμπλήρωσε το `web/config.js` με το **Project URL** και το **anon public key** (Project Settings → API). Το anon key είναι δημόσιο· την ασφάλεια την κάνουν οι κανόνες της βάσης.
2. Ανέβασε τα περιεχόμενα του `web/` σε GitHub repo → **Settings → Pages** → Deploy from branch `main`, φάκελος `/ (root)`.
3. Δικό σου domain (προαιρετικά): Pages → Custom domain, και στον πάροχο του domain ένα `CNAME` προς `<user>.github.io`.

### 4. Πρώτο στήσιμο
1. Μπες στη σελίδα με Google.
2. Supabase → SQL Editor → τρέξε το `05_admin.sql` (σε κάνει διοργανωτή· έχει μέσα το email σου).
3. Ανανέωσε τη σελίδα → **Δημιουργία κόσμου**: 3 λίγκες, 24 σύλλογοι, ρόστερ για τους αυτόματους, πρόγραμμα, τιμές.
4. Οι managers μπαίνουν με Google και αναλαμβάνουν σύλλογο από τις **Ομάδες**. Μετά από τη **Διαχείριση** ανοίγεις γύρο κρυφών προσφορών.

## Επιστροφή σε παλιότερη έκδοση
- Σελίδα: κάθε αλλαγή είναι commit στο GitHub· ένα revert τη γυρίζει πίσω.
- Βάση: το Supabase κρατά καθημερινό backup (Database → Backups). Το `audit` καταγράφει κάθε ενέργεια διοργάνωσης.

## Προεπιλογές που θέλουν έγκρισή σου
Είναι ρυθμίσεις στον πίνακα `config` και αλλάζουν χωρίς κώδικα:
budget 600.000 · νίκη 10.000 / ισοπαλία 3.000 · 8 προσφορές ανά γύρο · ενεργοποίηση κάρτας σε 72 ώρες · προτάσεις λήγουν σε 72 ώρες · προσωρινή κάλυψη έως OVR 65 · αποδέσμευση με επιστροφή 50% · αυτόματοι σύλλογοι δέχονται από 115% του κόστους.
