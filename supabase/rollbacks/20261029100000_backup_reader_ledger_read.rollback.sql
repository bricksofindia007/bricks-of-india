-- Rollback for 20261029100000_backup_reader_ledger_read.sql (issue 877). Removes the read access the migration added. Only with Chat's OK.
revoke select on supabase_migrations.schema_migrations, supabase_migrations.data_fix_log from backup_reader;
revoke usage on schema supabase_migrations from backup_reader;
