-- boi:issue 143
-- boi:backup-tables supabase_migrations.schema_migrations
-- boi:expect-before select count(*) from information_schema.tables where table_schema = 'boi_backups' and table_name like 'public\_\_%' = 36
-- boi:expect-after select count(*) from information_schema.tables where table_schema = 'boi_backups' and table_name like 'public\_\_%' = 0
-- Drops exactly the 36 public__ backup tables in boi_backups (Chat 18:30 order item 6; issue 143). Post-check: every one of the 52
-- tables that must remain still exists, compared by name. The runner adds its own new data_fix_log copy, which is expected.
DO $$
DECLARE
  t text;
  drop_names text[] := ARRAY[
  'public__guides__20261002t052725',
  'public__guides__20261002t062945',
  'public__guides__20261004t073903',
  'public__guides__20261013t044107',
  'public__news_articles__20260930t030904',
  'public__news_articles__20260930t193234',
  'public__news_articles__20261001t163058',
  'public__news_articles__20261001t165208',
  'public__news_articles__20261002t052725',
  'public__news_articles__20261002t062945',
  'public__news_articles__20261004t073903',
  'public__news_articles__20261013t044107',
  'public__news_articles__20261019t181359',
  'public__pending_drafts__20261019t094856',
  'public__pending_drafts__backlog',
  'public__price_history__20261001t041940',
  'public__price_history__20261004t073903',
  'public__reviews__20261001t163058',
  'public__reviews__20261001t165208',
  'public__reviews__20261002t052725',
  'public__reviews__20261002t062945',
  'public__reviews__20261004t073903',
  'public__reviews__20261013t044107',
  'public__reviews__20261015t185309',
  'public__reviews__20261016t052140',
  'public__reviews__20261018t195632',
  'public__reviews__20261019t181359',
  'public__set_name_aliases__20260930t030904',
  'public__sets__20260930t030904',
  'public__sets__20261004t073903',
  'public__sets__20261020t141041',
  'public__store_prices__20261001t042858',
  'public__store_prices__20261004t073903',
  'public__stores__20261001t042858',
  'public__stores__20261001t165208',
  'public__stores__20261021t053030'
  ];
  keep_names text[] := ARRAY[
  'manifest',
  'supabase_migrations__data_fix_log__20260930t030904',
  'supabase_migrations__data_fix_log__20260930t032530',
  'supabase_migrations__data_fix_log__20260930t193234',
  'supabase_migrations__data_fix_log__20260930t193449',
  'supabase_migrations__data_fix_log__20260930t200155',
  'supabase_migrations__data_fix_log__20261001t041940',
  'supabase_migrations__data_fix_log__20261001t042858',
  'supabase_migrations__data_fix_log__20261001t163058',
  'supabase_migrations__data_fix_log__20261001t165208',
  'supabase_migrations__data_fix_log__20261002t052725',
  'supabase_migrations__data_fix_log__20261002t062945',
  'supabase_migrations__data_fix_log__20261003t122613',
  'supabase_migrations__data_fix_log__20261004t073903',
  'supabase_migrations__data_fix_log__20261004t104152',
  'supabase_migrations__data_fix_log__20261013t044107',
  'supabase_migrations__data_fix_log__20261015t185309',
  'supabase_migrations__data_fix_log__20261016t052140',
  'supabase_migrations__data_fix_log__20261018t195030',
  'supabase_migrations__data_fix_log__20261018t195632',
  'supabase_migrations__data_fix_log__20261018t202351',
  'supabase_migrations__data_fix_log__20261019t094856',
  'supabase_migrations__data_fix_log__20261019t181359',
  'supabase_migrations__data_fix_log__20261020t141041',
  'supabase_migrations__data_fix_log__20261020t181051',
  'supabase_migrations__data_fix_log__20261021t053030',
  'supabase_migrations__schema_migrations__20260930t030904',
  'supabase_migrations__schema_migrations__20260930t032530',
  'supabase_migrations__schema_migrations__20260930t193234',
  'supabase_migrations__schema_migrations__20260930t193449',
  'supabase_migrations__schema_migrations__20260930t200155',
  'supabase_migrations__schema_migrations__20261001t041940',
  'supabase_migrations__schema_migrations__20261001t042858',
  'supabase_migrations__schema_migrations__20261001t163058',
  'supabase_migrations__schema_migrations__20261001t165208',
  'supabase_migrations__schema_migrations__20261002t052725',
  'supabase_migrations__schema_migrations__20261002t062945',
  'supabase_migrations__schema_migrations__20261003t122613',
  'supabase_migrations__schema_migrations__20261004t073903',
  'supabase_migrations__schema_migrations__20261004t104152',
  'supabase_migrations__schema_migrations__20261013t044107',
  'supabase_migrations__schema_migrations__20261015t185309',
  'supabase_migrations__schema_migrations__20261016t052140',
  'supabase_migrations__schema_migrations__20261018t195030',
  'supabase_migrations__schema_migrations__20261018t195632',
  'supabase_migrations__schema_migrations__20261018t202351',
  'supabase_migrations__schema_migrations__20261019t094856',
  'supabase_migrations__schema_migrations__20261019t181359',
  'supabase_migrations__schema_migrations__20261020t141041',
  'supabase_migrations__schema_migrations__20261020t181051',
  'supabase_migrations__schema_migrations__20261021t053030',
  'supabase_migrations__schema_migrations__20260930t025007'
  ];
BEGIN
  FOREACH t IN ARRAY drop_names LOOP
    EXECUTE format('DROP TABLE boi_backups.%I', t);
  END LOOP;
  FOREACH t IN ARRAY keep_names LOOP
    IF to_regclass(format('boi_backups.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'table that must remain is missing: %', t;
    END IF;
  END LOOP;
END $$;
