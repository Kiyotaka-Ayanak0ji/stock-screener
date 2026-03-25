
CREATE TABLE public.app_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text,
  designation text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text NOT NULL,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved reviews (for landing page)
CREATE POLICY "Anyone can read approved reviews"
  ON public.app_reviews FOR SELECT
  TO anon, authenticated
  USING (is_approved = true);

-- Authenticated users can insert their own review
CREATE POLICY "Users can insert their own review"
  ON public.app_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own review
CREATE POLICY "Users can update their own review"
  ON public.app_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own review
CREATE POLICY "Users can delete their own review"
  ON public.app_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
