-- Staging only: one price for fixture set 900902 at one store. :price is digits (the workflow checks).
-- Refuses unless 900902 is a fixture row. Changes only a row whose product_url is the fixture marker.
begin;
do $$ begin
  if (select count(*) from public.sets where set_number = '900902' and description = 'FIXTURE STAGING ONLY') <> 1 then
    raise exception 'price fixture: set 900902 is missing; stopped, nothing written';
  end if;
end $$;
insert into public.store_prices (set_id, store_id, price_inr, in_stock, product_url, scraped_at)
values ('900902', 'toycra', :price, true, 'FIXTURE STAGING ONLY', now())
on conflict (set_id, store_id) do update set price_inr = excluded.price_inr, scraped_at = now()
  where public.store_prices.product_url = 'FIXTURE STAGING ONLY';
commit;
