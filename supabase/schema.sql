CREATE TABLE IF NOT EXISTS public."usr_nmexs7bytxq2_diver_progress" (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  points integer not null default 0,
  high_score integer not null default 0,
  max_level integer not null default 1,
  loadout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public."usr_nmexs7bytxq2_diver_progress" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usr_nmexs7bytxq2_diver_progress'
      AND policyname = 'auth_user_access'
  ) THEN
    CREATE POLICY "auth_user_access" ON public."usr_nmexs7bytxq2_diver_progress"
    FOR ALL TO authenticated
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."usr_nmexs7bytxq2_diver_progress" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."usr_nmexs7bytxq2_diver_progress" TO service_role;

CREATE INDEX IF NOT EXISTS "usr_nmexs7bytxq2_diver_progress_user_id_idx"
ON public."usr_nmexs7bytxq2_diver_progress" (user_id);
