-- Rollback for data fix 143-drop-public-backup-tables (issue 143). THERE IS NO SQL ROLLBACK.
-- The fix drops 36 backup tables in boi_backups (public__ copies). A dropped table cannot be recreated from SQL.
-- The only way back is the encrypted nightly backup bundle, restored by hand, for only the tables named here, and only
-- with the owner's written approval and Chat's OK. Until then this file does nothing.
-- This file only reports how many of the 36 tables are missing. It changes nothing.
select count(*) as dropped_tables_missing
from (values
  ('public__guides__20261002t052725'), ('public__guides__20261002t062945'), ('public__guides__20261004t073903'), ('public__guides__20261013t044107'),
  ('public__news_articles__20260930t030904'), ('public__news_articles__20260930t193234'), ('public__news_articles__20261001t163058'),
  ('public__news_articles__20261001t165208'), ('public__news_articles__20261002t052725'), ('public__news_articles__20261002t062945'),
  ('public__news_articles__20261004t073903'), ('public__news_articles__20261013t044107'), ('public__news_articles__20261019t181359'),
  ('public__pending_drafts__20261019t094856'), ('public__pending_drafts__backlog'), ('public__price_history__20261001t041940'),
  ('public__price_history__20261004t073903'), ('public__reviews__20261001t163058'), ('public__reviews__20261001t165208'),
  ('public__reviews__20261002t052725'), ('public__reviews__20261002t062945'), ('public__reviews__20261004t073903'),
  ('public__reviews__20261013t044107'), ('public__reviews__20261015t185309'), ('public__reviews__20261016t052140'),
  ('public__reviews__20261018t195632'), ('public__reviews__20261019t181359'), ('public__set_name_aliases__20260930t030904'),
  ('public__sets__20260930t030904'), ('public__sets__20261004t073903')
) as t(name)
where to_regclass(format('boi_backups.%I', t.name)) is null;
