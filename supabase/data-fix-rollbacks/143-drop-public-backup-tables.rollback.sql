-- DRAFT rollback note for data fix 143 (drops the 36 public__ backup copies in boi_backups). Not applied.
-- This cannot be reversed in SQL. The fix dropped the tables; there is no copy inside the database to restore from.
-- The only restore path is the external backup dump taken before the drop. Restore is a manual step for the owner, not a script here.
-- The statement below stops any run of this file on purpose, so it cannot be run by accident.
DO $$
BEGIN
  RAISE EXCEPTION 'data fix 143 is not reversible in SQL; restore the 36 boi_backups.public__ tables from the external dump by hand (owner decision)';
END $$;
