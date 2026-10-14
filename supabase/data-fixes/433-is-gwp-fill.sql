-- boi:issue 433
-- boi:backup-tables public.sets
-- boi:expect-before select count(*) from public.sets where (set_number, is_gwp) in (values ('40730', false), ('40774', false), ('40887', false), ('40892', false), ('40893', false), ('40897', false), ('40899', false), ('40900', false), ('40901', false), ('40902', false), ('40906', false), ('40913', false), ('40916', false), ('40917', false), ('5009005', false), ('5010927', false), ('5011072', false), ('30730', true), ('40919', true)) = 19
-- boi:expect-after select count(*) from public.sets where (set_number, is_gwp) in (values ('40730', true), ('40774', true), ('40887', true), ('40892', true), ('40893', true), ('40897', true), ('40899', true), ('40900', true), ('40901', true), ('40902', true), ('40906', true), ('40913', true), ('40916', true), ('40917', true), ('5009005', true), ('5010927', true), ('5011072', true), ('30730', false), ('40919', false)) = 19
-- P11 item 2 (APPROVED by Abhinav, 29 Sep 2026): sets.is_gwp from Brickset's availability field.
-- is_gwp keeps its contract (baseline COMMENT): it explains an absent price, it never suppresses a real
-- store listing. Consumers: /reviews/[slug] (GWP wording when unpriced), Gate 14's gwp rule, and the
-- generator's gift-with-purchase price context (FEATURE_FLAGS.gwpNoPriceContext).
-- Scope: the sets our published content references (the #429 scan, 349 sets); a catalogue-wide fill is a
-- separate proposal. Evidence fetched 2026-09-29T02:27:00.736Z (boi-db-backups/2026-09-29-is-gwp/evidence.json):
--   40730    false->true  "Luke Skywalker's Lightsaber" -- Brickset setID 48959 (https://brickset.com/sets/40730-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40774    false->true  "Classic Animation Scenes" -- Brickset setID 52074 (https://brickset.com/sets/40774-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40887    false->true  "Ditto as Squirtle: Movie Night" -- Brickset setID 52053 (https://brickset.com/sets/40887-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40892    false->true  "Kanto Region Badge Collection" -- Brickset setID 51991 (https://brickset.com/sets/40892-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40893    false->true  "Grond" -- Brickset setID 52737 (https://brickset.com/sets/40893-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40897    false->true  "Darth Vader's LIGHTSABER" -- Brickset setID 53175 (https://brickset.com/sets/40897-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40899    false->true  "Astro Bot" -- Brickset setID 53174 (https://brickset.com/sets/40899-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40900    false->true  "Scary Haunted Tree" -- Brickset setID 53375 (https://brickset.com/sets/40900-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40901    false->true  "Ministry Munchies & The Daily Prophet Stands" -- Brickset setID 53123 (https://brickset.com/sets/40901-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40902    false->true  "Tribute to Leonardo da Vinci" -- Brickset setID 52782 (https://brickset.com/sets/40902-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40906    false->true  "Restaurants of the World: Japan" -- Brickset setID 52405 (https://brickset.com/sets/40906-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40913    false->true  "Vintage Parade Car" -- Brickset setID 51757 (https://brickset.com/sets/40913-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40916    false->true  "Floral Picture Frame" -- Brickset setID 52411 (https://brickset.com/sets/40916-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   40917    false->true  "The Darksaber" -- Brickset setID 52273 (https://brickset.com/sets/40917-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   5009005  false->true  "Entrance Gate" -- Brickset setID 50518 (https://brickset.com/sets/5009005-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   5010927  false->true  "Straw Topper Set" -- Brickset setID 53130 (https://brickset.com/sets/5010927-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   5011072  false->true  "Ministry of Magic Phone Booth" -- Brickset setID 53295 (https://brickset.com/sets/5011072-1): availability "LEGO Gift with Purchase"; no LEGO.com retail price
--   30730    true->false  "Trainer Supplies" -- Brickset setID 52052 (https://brickset.com/sets/30730-1): availability "Retail - limited"; no LEGO.com retail price
--   40919    true->false  "Gremlins Gizmo and Stripe Figures" -- Brickset setID 52989 (https://brickset.com/sets/40919-1): availability "LEGO exclusive"; US $24.99, UK £19.99
-- 30730 and 40919 were hand-flagged on 26 Aug (migration 20260825183631); Brickset lists them as
-- "Retail - limited" and "LEGO exclusive" (40919 sells at US$24.99 / UK £19.99), so they are not GWPs.
UPDATE public.sets SET is_gwp = true
 WHERE is_gwp = false AND set_number IN ('40730', '40774', '40887', '40892', '40893', '40897', '40899', '40900', '40901', '40902', '40906', '40913', '40916', '40917', '5009005', '5010927', '5011072');
UPDATE public.sets SET is_gwp = false
 WHERE is_gwp = true AND set_number IN ('30730', '40919');
