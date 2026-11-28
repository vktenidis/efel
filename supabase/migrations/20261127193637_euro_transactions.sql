-- Fixed denomination of historical league balances, independent of player repricing.
create function public.efel_units_from_eur(p_eur numeric) returns integer
language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_eur is null or p_eur < 0 or p_eur > 1288490188200 or mod(p_eur, 600) <> 0 then
    raise exception 'Το ποσό πρέπει να είναι μη αρνητικό πολλαπλάσιο των 600 €.' using errcode='22023';
  end if;
  return (p_eur / 600)::integer;
end $$;

create function public.efel_place_bid_eur(p_player bigint, p_eur numeric) returns void
language sql security invoker set search_path = '' as $$
  select public.efel_place_bid(p_player, public.efel_units_from_eur(p_eur));
$$;

create function public.efel_make_offer_eur(p_player bigint, p_eur numeric, p_swap bigint default null) returns integer
language sql security invoker set search_path = '' as $$
  select public.efel_make_offer(p_player, public.efel_units_from_eur(p_eur), p_swap);
$$;

create function public.efel_counter_offer_eur(p_offer integer, p_eur numeric, p_swap bigint, p_note text) returns void
language sql security invoker set search_path = '' as $$
  select public.efel_counter_offer(p_offer, public.efel_units_from_eur(p_eur), p_swap, p_note);
$$;

revoke all on function public.efel_units_from_eur(numeric), public.efel_place_bid_eur(bigint,numeric),
  public.efel_make_offer_eur(bigint,numeric,bigint), public.efel_counter_offer_eur(integer,numeric,bigint,text) from public, anon;
grant execute on function public.efel_units_from_eur(numeric), public.efel_place_bid_eur(bigint,numeric),
  public.efel_make_offer_eur(bigint,numeric,bigint), public.efel_counter_offer_eur(integer,numeric,bigint,text) to authenticated;
