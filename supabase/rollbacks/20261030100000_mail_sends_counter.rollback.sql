-- Rollback for 20261030100000_mail_sends_counter.sql (issue 879). Drops the counter table. Only with Chat's OK: it removes the counts.
drop table if exists public.mail_sends;
