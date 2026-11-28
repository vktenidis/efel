create or replace function public.efel_save_squad(p_f text, p_xi jsonb, p_bench jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare c int := public.efel_require_club();
begin
  if p_f is null or p_f not in ('4-4-2','4-3-3','4-2-3-1','3-5-2','3-4-3') then
    raise exception 'Μη έγκυρος σχηματισμός.';
  end if;
  if p_xi is null or jsonb_typeof(p_xi) <> 'array' or jsonb_array_length(p_xi) <> 11 then
    raise exception 'Η ενδεκάδα πρέπει να έχει 11 θέσεις.';
  end if;
  if p_bench is null or jsonb_typeof(p_bench) <> 'array' or jsonb_array_length(p_bench) > 12 then
    raise exception 'Έως 12 αναπληρωματικοί.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_xi) x where x <> 'null'::jsonb and (jsonb_typeof(x) <> 'number' or x::text !~ '^[0-9]+$'))
     or exists (select 1 from jsonb_array_elements(p_bench) x where jsonb_typeof(x) <> 'number' or x::text !~ '^[0-9]+$') then
    raise exception 'Μη έγκυρος παίκτης.';
  end if;
  if exists (select 1 from (select x from jsonb_array_elements_text(p_xi) x where x is not null union all select x from jsonb_array_elements_text(p_bench) x) a group by x having count(*) > 1) then
    raise exception 'Ο ίδιος παίκτης δεν μπορεί να εμφανίζεται δύο φορές.';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_xi) x where x is not null and not exists
    (select 1 from public.roster r where r.club_id=c and r.player_id::text=x and r.activation='active')) then
    raise exception 'Στην ενδεκάδα μπαίνουν μόνο ενεργοποιημένοι παίκτες του ρόστερ σου.';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_bench) x where not exists
    (select 1 from public.roster r where r.club_id=c and r.player_id::text=x)) then
    raise exception 'Στον πάγκο μπαίνουν μόνο παίκτες του ρόστερ σου.';
  end if;
  update public.clubs set lineup=coalesce(lineup,'{}'::jsonb) || jsonb_build_object('f',p_f,'xi',p_xi,'bench',p_bench) where id=c;
end $$;
revoke all on function public.efel_save_squad(text,jsonb,jsonb) from public, anon;
grant execute on function public.efel_save_squad(text,jsonb,jsonb) to authenticated;
