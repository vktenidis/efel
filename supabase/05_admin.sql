-- Αφού συνδεθείς μία φορά στην εφαρμογή με το Google σου, κάνε τον λογαριασμό σου διαχειριστή.
-- Βάλε το δικό σου email:
update profiles set is_admin = true where id = (select id from auth.users where email = 'v.ktenidis@gmail.com');
