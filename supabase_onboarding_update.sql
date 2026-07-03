-- ============================================================
-- Kalorimetre — Onboarding Profile Schema Update
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Maps every field saved by OnboardingWizard.finish() → completeOnboarding()
-- Frontend payload shape (also stored in full inside raw_data JSONB):
--
--   stats:            { gender, age, height, weight, activity }
--   primaryGoal,      goalOffset, dailyGoal, tdee
--   dietPhilosophy,   allergies[], medicalHistory[], healthConditions[]
--   mode,             macros{ protein, carbs, fat, fiber, sugar }, dietPlan[]
--   userId,           onboardingComplete
--
-- Current upsert (DietContext) writes: id, target_calories, target_protein,
-- target_carbs, target_fat, raw_data, updated_at
-- ============================================================

-- ─── Ensure base table exists ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id               uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_calories  int         DEFAULT 2000,
  target_protein   int         DEFAULT 130,
  target_carbs     int         DEFAULT 260,
  target_fat       int         DEFAULT 65,
  raw_data         jsonb,
  updated_at       timestamptz DEFAULT now()
);

-- ─── Core macro targets (written on every upsert) ────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_calories  int         DEFAULT 2000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_protein   int         DEFAULT 130;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_carbs     int         DEFAULT 260;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_fat       int         DEFAULT 65;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_fiber     int         DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_sugar     int         DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS raw_data         jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

-- ─── Step 1: Temel Bilgiler (stats object) ───────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender          text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age             int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm       numeric(5,1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_kg        numeric(5,1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activity_level  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stats           jsonb;

-- ─── Step 2: Ana Hedef ───────────────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_goal    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_offset     int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_goal      int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tdee              int;

-- ─── Step 3: Diyet Felsefesi ─────────────────────────────────────────────────
-- Values: standart | vegan | vejetaryen | keto | akdeniz

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS diet_philosophy text;

-- ─── Step 4: Alerji & Dışlamalar ─────────────────────────────────────────────
-- Values: gluten | laktoz | kuruyemis | deniz_urunleri | yok

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allergies         jsonb DEFAULT '[]'::jsonb;

-- ─── Step 5: Tıbbi Geçmiş ────────────────────────────────────────────────────
-- Values: yok | insulin_direnci | diyabet_tip1 | diyabet_tip2 | tansiyon |
--         kolesterol | tiroid | pcos

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_history   jsonb DEFAULT '[]'::jsonb;

-- Derived flags for health engine (colyak | laktoz | kuruyemis | diyabet)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS health_conditions jsonb DEFAULT '[]'::jsonb;

-- ─── Step 6: Mod Seçimi ──────────────────────────────────────────────────────
-- Values: manual | ocr

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mode              text;

-- ─── Computed macros + OCR diet plan ─────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS macros            jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS diet_plan         jsonb;

-- ─── Onboarding completion flag ──────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- ─── Row Level Security (safe to re-run) ─────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles: select own'
  ) THEN
    CREATE POLICY "profiles: select own"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles: insert own'
  ) THEN
    CREATE POLICY "profiles: insert own"
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles: update own'
  ) THEN
    CREATE POLICY "profiles: update own"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles: delete own'
  ) THEN
    CREATE POLICY "profiles: delete own"
      ON public.profiles FOR DELETE
      USING (auth.uid() = id);
  END IF;
END $$;
