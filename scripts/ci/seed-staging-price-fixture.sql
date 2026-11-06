-- Staging only. Sets one price for fixture set 854335 at one store, so the price proof can run on staging.
-- psql variable :price is a whole number, checked by the workflow before this runs.
-- * Only the fixture set (marker in sets.description) can be priced. Any other set: refused, nothing written.
-- * Only a row this file made (product_url is the marker) is ever changed. A real row is left alone.
begin;

do $$
begin
  if (select count(*) from public.sets where set_number = '854335' and description = 'FIXTURE STAGING ONLY') <> 1 then
    raise exception 'price fixture: the fixture set 854335 is missing; stopped, nothing written';
  end if;
end $$;

insert into public.store_prices (set_id, store_id, price_inr, in_stock, product_url, scraped_at)
values ('854335', 'toycra', :price, true, 'FIXTURE STAGING ONLY', now())
on conflict (set_id, store_id) do update
  set price_inr = excluded.price_inr, in_stock = true, scraped_at = now()
  where public.store_prices.product_url = 'FIXTURE STAGING ONLY';

commit;
