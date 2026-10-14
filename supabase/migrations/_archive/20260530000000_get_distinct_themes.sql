-- RPC: get_distinct_themes
-- Returns all distinct non-null, non-empty theme values from the sets table,
-- sorted alphabetically. Used by /sets filter dropdown.

CREATE OR REPLACE FUNCTION get_distinct_themes()
RETURNS TABLE(theme TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT s.theme
  FROM   sets s
  WHERE  s.theme IS NOT NULL
    AND  s.theme <> ''
  ORDER  BY s.theme;
$$;

-- Allow anon and authenticated roles to call it (public read-only)
GRANT EXECUTE ON FUNCTION get_distinct_themes() TO anon, authenticated;
