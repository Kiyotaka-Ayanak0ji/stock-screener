-- 1. Fix app_reviews: force new reviews into pending (unapproved) state
ALTER TABLE public.app_reviews ALTER COLUMN is_approved SET DEFAULT false;

DROP POLICY IF EXISTS "Users can insert their own review" ON public.app_reviews;
CREATE POLICY "Users can insert their own review"
  ON public.app_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_approved = false);

-- Prevent users from approving their own reviews via UPDATE
DROP POLICY IF EXISTS "Users can update their own review" ON public.app_reviews;
CREATE POLICY "Users can update their own review"
  ON public.app_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_approved = false);

-- 2. Restrict listing on the public stock-bucket while preserving direct URL access.
-- Direct downloads via public URL go through Storage's CDN (not RLS-checked for public buckets),
-- so this only blocks the LIST operation that exposes every file name.
DROP POLICY IF EXISTS "Public can read stock-bucket files" ON storage.objects;