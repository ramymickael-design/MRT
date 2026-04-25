-- ============================================================
-- STEP 1: Add plan column to subscriptions
-- ============================================================
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'pro';
  -- Values: 'pro' | 'elite'

-- ============================================================
-- STEP 2: Update existing rows to have a plan
-- ============================================================
UPDATE public.subscriptions SET plan = 'pro' WHERE plan IS NULL;

-- ============================================================
-- STEP 3: Give yourself Elite access for free permanently
-- ============================================================
UPDATE public.subscriptions
SET
  status = 'active',
  plan   = 'elite',
  trial_end = null,
  current_period_end = now() + interval '100 years'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'ramymickael@gmail.com'
);

-- ============================================================
-- STEP 4: Update the auto-trial trigger to include plan
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  INSERT INTO public.subscriptions (user_id, status, plan, trial_end)
  VALUES (
    new.id,
    'trialing',
    'pro',
    now() + interval '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
end;
$$;

-- ============================================================
-- STEP 5: Verify
-- ============================================================
SELECT
  u.email,
  s.status,
  s.plan,
  s.trial_end,
  s.current_period_end
FROM public.subscriptions s
JOIN auth.users u ON u.id = s.user_id
ORDER BY s.created_at DESC
LIMIT 10;
