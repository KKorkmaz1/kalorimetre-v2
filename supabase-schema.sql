-- ============================================================
-- Kalorimetre — Supabase Postgres Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ─── 1. PROFILES ─────────────────────────────────────────────────────────────
-- One row per authenticated user.
-- Structured columns for important macro targets (indexable, queryable).
-- raw_data JSONB stores the complete profile object as-is from the frontend,
-- preserving all fields (age, weight, height, theme, bodyComp, etc.) without
-- requiring a migration every time a new field is added.

CREATE TABLE IF NOT EXISTS public.profiles (
  id               uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_calories  int         DEFAULT 2000,
  target_protein   int         DEFAULT 130,
  target_carbs     int         DEFAULT 260,
  target_fat       int         DEFAULT 65,
  raw_data         jsonb,
  updated_at       timestamptz DEFAULT now()
);

-- ─── 2. DAILY_LOGS ───────────────────────────────────────────────────────────
-- One row per (user, date). Upserted on every meal add/delete/water update.
-- meals_data JSONB stores { logs: [...], water: N } — the full day snapshot.
-- total_kcal is a denormalised summary for fast queries (charts, streak calc).

CREATE TABLE IF NOT EXISTS public.daily_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  total_kcal  int         DEFAULT 0,
  meals_data  jsonb       NOT NULL DEFAULT '{"logs":[],"water":0}'::jsonb,
  updated_at  timestamptz DEFAULT now(),

  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS daily_logs_user_date_idx ON public.daily_logs (user_id, date DESC);

-- ─── 3. SAVED_FOODS ──────────────────────────────────────────────────────────
-- User's personal food library — items saved from barcode scans or AI NLP.
-- All nutritional values are per 100 g.

CREATE TABLE IF NOT EXISTS public.saved_foods (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname       text        NOT NULL,
  original_name  text,
  kcal           numeric(7,1) DEFAULT 0,   -- kcal per 100 g
  protein        numeric(6,1) DEFAULT 0,
  carbs          numeric(6,1) DEFAULT 0,
  fat            numeric(6,1) DEFAULT 0,
  fiber          numeric(6,1) DEFAULT 0,
  sugar          numeric(6,1) DEFAULT 0,
  default_unit   text        DEFAULT 'gram',
  default_weight int         DEFAULT 100,  -- default serving in grams
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_foods_user_idx ON public.saved_foods (user_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- Users can ONLY access rows that belong to them.
-- ============================================================

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_foods ENABLE ROW LEVEL SECURITY;

-- ─── profiles policies ───────────────────────────────────────────────────────

CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: delete own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ─── daily_logs policies ─────────────────────────────────────────────────────

CREATE POLICY "daily_logs: select own"
  ON public.daily_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "daily_logs: insert own"
  ON public.daily_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_logs: update own"
  ON public.daily_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "daily_logs: delete own"
  ON public.daily_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ─── saved_foods policies ────────────────────────────────────────────────────

CREATE POLICY "saved_foods: select own"
  ON public.saved_foods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "saved_foods: insert own"
  ON public.saved_foods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_foods: update own"
  ON public.saved_foods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "saved_foods: delete own"
  ON public.saved_foods FOR DELETE
  USING (auth.uid() = user_id);
