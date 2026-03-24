ALTER TABLE public.profiles ALTER COLUMN email_opt_in SET DEFAULT true;
UPDATE public.profiles SET email_opt_in = true WHERE email_opt_in = false;