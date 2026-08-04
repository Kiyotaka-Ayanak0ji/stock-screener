-- =====================================================================
-- EquityIQ :: consolidated production baseline
--
-- One replayable migration that recreates the ENTIRE backend schema:
-- enums, schemas, tables, constraints, indexes, row level security
-- policies, grants, functions and triggers.
--
-- Purpose: redeploying the app against a different Postgres/Supabase
-- instance must never lose or reshape user data. Apply this file to an
-- empty database, restore the row data, and the app runs unchanged.
--
-- The file is idempotent: every statement is guarded, so re-running it
-- against an existing database is a no-op instead of an error.
--
-- Row data is NOT included here. Export/import it separately (see
-- MIGRATION.md, section "Restore data").
-- =====================================================================

-- Function bodies reference tables created later in this file.
SET check_function_bodies = false;

DO $do$ BEGIN CREATE SCHEMA IF NOT EXISTS private;
EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN duplicate_schema THEN NULL; END $do$;

DO $do$ BEGIN CREATE SCHEMA IF NOT EXISTS public;
EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN duplicate_schema THEN NULL; END $do$;

DO $do$ BEGIN
CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pgmq'
    AS $$ SELECT pgmq.delete(queue_name, message_id); $$;

CREATE OR REPLACE FUNCTION public.email_queue_dispatch() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    BEGIN
      -- Serialize disarm against email_queue_wake on a shared advisory lock, then
      -- re-read under it: an enqueue racing the unschedule either committed (we
      -- see its row and leave the cron) or waits and re-arms after we commit.
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
      IF EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
         OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
        RETURN;
      END IF;
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  IF (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://szkezahvdumeiqmnlugj.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.email_queue_wake() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
BEGIN
  -- Runs inside the enqueue transaction; the outer handler guarantees nothing
  -- below can roll back the customer's email. Shared advisory lock serializes
  -- arming against email_queue_dispatch's disarm.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule('process-email-queue', '5 seconds', $cron$ SELECT public.email_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://szkezahvdumeiqmnlugj.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
  RETURN NULL;
END;
$_$;

CREATE OR REPLACE FUNCTION public.enforce_watchlist_quota() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_count integer;
  user_plan text;
  user_status text;
  max_allowed integer;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT plan, status INTO user_plan, user_status
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF user_plan IS NULL OR user_status IN ('expired', 'cancelled') THEN
    max_allowed := 1;
  ELSIF user_plan = 'lifetime' THEN
    max_allowed := NULL; -- unlimited (legacy lifetime members)
  ELSIF user_plan IN ('premium_plus', 'premium_plus_monthly', 'premium_plus_yearly') THEN
    max_allowed := 50;
  ELSIF user_plan IN ('premium', 'premium_monthly', 'premium_yearly') THEN
    max_allowed := 20;
  ELSIF user_plan IN ('pro', 'monthly', 'yearly') THEN
    max_allowed := 5;
  ELSE
    max_allowed := 1;
  END IF;

  IF max_allowed IS NOT NULL THEN
    SELECT COUNT(*) INTO current_count
    FROM public.user_watchlists
    WHERE user_id = NEW.user_id;

    IF current_count >= max_allowed THEN
      RAISE EXCEPTION 'Watchlist quota exceeded for your plan (max %).', max_allowed
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb) RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pgmq'
    AS $$ SELECT pgmq.send(queue_name, payload); $$;

CREATE OR REPLACE FUNCTION public.handle_new_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'trial', now() + interval '15 days');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pgmq'
    AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pgmq'
    AS $$ SELECT msg_id, read_ct, message FROM pgmq.read(queue_name, vt, batch_size); $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.app_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name text,
    designation text,
    rating integer NOT NULL,
    review text NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.cached_stock_prices (
    ticker text NOT NULL,
    exchange text NOT NULL,
    price numeric NOT NULL,
    previous_close numeric NOT NULL,
    change numeric NOT NULL,
    change_percent numeric NOT NULL,
    high numeric NOT NULL,
    low numeric NOT NULL,
    open_price numeric NOT NULL,
    volume bigint NOT NULL,
    market_cap numeric NOT NULL,
    name text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pe numeric DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text,
    template_name text NOT NULL,
    recipient_email text NOT NULL,
    status text NOT NULL,
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_send_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'suppressed'::text, 'failed'::text, 'bounced'::text, 'complained'::text, 'dlq'::text])))
);

CREATE TABLE IF NOT EXISTS public.email_send_state (
    id integer DEFAULT 1 NOT NULL,
    retry_after_until timestamp with time zone,
    batch_size integer DEFAULT 10 NOT NULL,
    send_delay_ms integer DEFAULT 200 NOT NULL,
    auth_email_ttl_minutes integer DEFAULT 15 NOT NULL,
    transactional_email_ttl_minutes integer DEFAULT 60 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_send_state_id_check CHECK ((id = 1))
);

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.portfolio_holdings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticker text NOT NULL,
    exchange text DEFAULT 'NSE'::text NOT NULL,
    buy_price numeric NOT NULL,
    quantity numeric NOT NULL,
    buy_date date DEFAULT CURRENT_DATE NOT NULL,
    sector text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_opt_in boolean DEFAULT true NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sector_cache (
    ticker text NOT NULL,
    sector text NOT NULL,
    source text DEFAULT 'screener'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.seed_job_progress (
    id integer DEFAULT 1 NOT NULL,
    cycle_started_at timestamp with time zone,
    last_chunk_at timestamp with time zone,
    total integer DEFAULT 0 NOT NULL,
    processed integer DEFAULT 0 NOT NULL,
    succeeded integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'idle'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seed_job_progress_id_check CHECK ((id = 1)),
    CONSTRAINT seed_job_progress_status_check CHECK ((status = ANY (ARRAY['idle'::text, 'running'::text, 'paused'::text])))
);

CREATE TABLE IF NOT EXISTS public.shared_watchlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    share_token text NOT NULL,
    owner_id uuid NOT NULL,
    watchlist_name text NOT NULL,
    tickers text NOT NULL,
    stock_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.stock_price_history (
    id bigint NOT NULL,
    ticker text NOT NULL,
    exchange text NOT NULL,
    price numeric NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.stock_price_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.stock_price_history_id_seq OWNED BY public.stock_price_history.id;

CREATE TABLE IF NOT EXISTS public.stock_universe (
    id bigint NOT NULL,
    ticker text NOT NULL,
    exchange text NOT NULL,
    segment text DEFAULT 'MAIN'::text NOT NULL,
    name text,
    bse_code text,
    last_seeded_at timestamp with time zone,
    last_status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_universe_exchange_check CHECK ((exchange = ANY (ARRAY['NSE'::text, 'BSE'::text]))),
    CONSTRAINT stock_universe_last_status_check CHECK ((last_status = ANY (ARRAY['pending'::text, 'ok'::text, 'failed'::text]))),
    CONSTRAINT stock_universe_segment_check CHECK ((segment = ANY (ARRAY['MAIN'::text, 'SME'::text])))
);

CREATE SEQUENCE IF NOT EXISTS public.stock_universe_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.stock_universe_id_seq OWNED BY public.stock_universe.id;

CREATE TABLE IF NOT EXISTS public.suppressed_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    reason text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suppressed_emails_reason_check CHECK ((reason = ANY (ARRAY['unsubscribe'::text, 'bounce'::text, 'complaint'::text])))
);

CREATE TABLE IF NOT EXISTS public.user_favourites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticker text NOT NULL,
    name text,
    exchange text DEFAULT 'NSE'::text NOT NULL,
    is_index boolean DEFAULT false NOT NULL,
    yahoo_symbol text,
    screener_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    watchlist text,
    notes text,
    events text,
    column_visibility text,
    custom_columns text,
    custom_column_data text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    price_triggers text,
    auto_refresh_on_load boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'trial'::text NOT NULL,
    trial_ends_at timestamp with time zone,
    subscription_starts_at timestamp with time zone,
    subscription_ends_at timestamp with time zone,
    razorpay_payment_id text,
    razorpay_order_id text,
    payment_method text,
    amount_usd numeric,
    amount_inr numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_watchlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    tickers text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.verification_debug_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticker text NOT NULL,
    exchange text NOT NULL,
    primary_source text,
    sources_used jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    final_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    final_values jsonb DEFAULT '{}'::jsonb NOT NULL,
    bse_code text,
    duration_ms integer,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.stock_price_history ALTER COLUMN id SET DEFAULT nextval('public.stock_price_history_id_seq'::regclass);

ALTER TABLE ONLY public.stock_universe ALTER COLUMN id SET DEFAULT nextval('public.stock_universe_id_seq'::regclass);

DO $do$ BEGIN
ALTER TABLE ONLY public.app_reviews
    ADD CONSTRAINT app_reviews_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.cached_stock_prices
    ADD CONSTRAINT cached_stock_prices_pkey PRIMARY KEY (ticker, exchange);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.email_send_state
    ADD CONSTRAINT email_send_state_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_email_key UNIQUE (email);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_token_key UNIQUE (token);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.portfolio_holdings
    ADD CONSTRAINT portfolio_holdings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.sector_cache
    ADD CONSTRAINT sector_cache_pkey PRIMARY KEY (ticker);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.seed_job_progress
    ADD CONSTRAINT seed_job_progress_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.shared_watchlists
    ADD CONSTRAINT shared_watchlists_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.shared_watchlists
    ADD CONSTRAINT shared_watchlists_share_token_key UNIQUE (share_token);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.stock_price_history
    ADD CONSTRAINT stock_price_history_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.stock_universe
    ADD CONSTRAINT stock_universe_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.stock_universe
    ADD CONSTRAINT stock_universe_ticker_exchange_key UNIQUE (ticker, exchange);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.suppressed_emails
    ADD CONSTRAINT suppressed_emails_email_key UNIQUE (email);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.suppressed_emails
    ADD CONSTRAINT suppressed_emails_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_favourites
    ADD CONSTRAINT user_favourites_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_favourites
    ADD CONSTRAINT user_favourites_user_id_ticker_key UNIQUE (user_id, ticker);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_watchlists
    ADD CONSTRAINT user_watchlists_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.verification_debug_logs
    ADD CONSTRAINT verification_debug_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log USING btree (message_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique ON public.email_send_log USING btree (message_id) WHERE (status = 'sent'::text);

CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log USING btree (recipient_email);

CREATE INDEX IF NOT EXISTS idx_sector_cache_sector ON public.sector_cache USING btree (sector);

CREATE INDEX IF NOT EXISTS idx_stock_price_history_ticker_recorded ON public.stock_price_history USING btree (ticker, exchange, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_universe_seed ON public.stock_universe USING btree (last_seeded_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_stock_universe_segment ON public.stock_universe USING btree (segment);

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails USING btree (email);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens USING btree (token);

CREATE INDEX IF NOT EXISTS idx_user_favourites_user_id ON public.user_favourites USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_verification_debug_logs_created_at ON public.verification_debug_logs USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_debug_logs_ticker ON public.verification_debug_logs USING btree (ticker);

DROP TRIGGER IF EXISTS enforce_watchlist_quota_trigger ON public.user_watchlists;
CREATE TRIGGER enforce_watchlist_quota_trigger BEFORE INSERT ON public.user_watchlists FOR EACH ROW EXECUTE FUNCTION public.enforce_watchlist_quota();

DROP TRIGGER IF EXISTS trg_seed_job_progress_updated_at ON public.seed_job_progress;
CREATE TRIGGER trg_seed_job_progress_updated_at BEFORE UPDATE ON public.seed_job_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_stock_universe_updated_at ON public.stock_universe;
CREATE TRIGGER trg_stock_universe_updated_at BEFORE UPDATE ON public.stock_universe FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_favourites_updated_at ON public.user_favourites;
CREATE TRIGGER update_user_favourites_updated_at BEFORE UPDATE ON public.user_favourites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_watchlists_updated_at ON public.user_watchlists;
CREATE TRIGGER update_user_watchlists_updated_at BEFORE UPDATE ON public.user_watchlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $do$ BEGIN
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.shared_watchlists
    ADD CONSTRAINT shared_watchlists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DO $do$ BEGIN
ALTER TABLE ONLY public.user_watchlists
    ADD CONSTRAINT user_watchlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $do$;

DROP POLICY IF EXISTS "Admins can delete verification debug logs" ON public.verification_debug_logs;
CREATE POLICY "Admins can delete verification debug logs" ON public.verification_debug_logs FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert app settings" ON public.app_settings;
CREATE POLICY "Admins can insert app settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can read app settings" ON public.app_settings;
CREATE POLICY "Admins can read app settings" ON public.app_settings FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can read seed progress" ON public.seed_job_progress;
CREATE POLICY "Admins can read seed progress" ON public.seed_job_progress FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can read verification debug logs" ON public.verification_debug_logs;
CREATE POLICY "Admins can read verification debug logs" ON public.verification_debug_logs FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
CREATE POLICY "Admins can update app settings" ON public.app_settings FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can read approved reviews" ON public.app_reviews;
CREATE POLICY "Anyone can read approved reviews" ON public.app_reviews FOR SELECT TO anon, authenticated USING ((is_approved = true));

DROP POLICY IF EXISTS "Anyone can read cached prices" ON public.cached_stock_prices;
CREATE POLICY "Anyone can read cached prices" ON public.cached_stock_prices FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read price history" ON public.stock_price_history;
CREATE POLICY "Anyone can read price history" ON public.stock_price_history FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read sector cache" ON public.sector_cache;
CREATE POLICY "Anyone can read sector cache" ON public.sector_cache FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read stock universe" ON public.stock_universe;
CREATE POLICY "Anyone can read stock universe" ON public.stock_universe FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Only service role can delete user roles" ON public.user_roles;
CREATE POLICY "Only service role can delete user roles" ON public.user_roles FOR DELETE USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Only service role can insert user roles" ON public.user_roles;
CREATE POLICY "Only service role can insert user roles" ON public.user_roles FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Only service role can update user roles" ON public.user_roles;
CREATE POLICY "Only service role can update user roles" ON public.user_roles FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Owners can manage their shared watchlists" ON public.shared_watchlists;
CREATE POLICY "Owners can manage their shared watchlists" ON public.shared_watchlists TO authenticated USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));

DROP POLICY IF EXISTS "Owners can view their shared watchlists" ON public.shared_watchlists;
CREATE POLICY "Owners can view their shared watchlists" ON public.shared_watchlists FOR SELECT TO authenticated USING ((auth.uid() = owner_id));

DROP POLICY IF EXISTS "Service role can delete old price history" ON public.stock_price_history;
CREATE POLICY "Service role can delete old price history" ON public.stock_price_history FOR DELETE USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can delete universe" ON public.stock_universe;
CREATE POLICY "Service role can delete universe" ON public.stock_universe FOR DELETE USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can insert cached prices" ON public.cached_stock_prices;
CREATE POLICY "Service role can insert cached prices" ON public.cached_stock_prices FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can insert price history" ON public.stock_price_history;
CREATE POLICY "Service role can insert price history" ON public.stock_price_history FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can insert sector cache" ON public.sector_cache;
CREATE POLICY "Service role can insert sector cache" ON public.sector_cache FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can insert universe" ON public.stock_universe;
CREATE POLICY "Service role can insert universe" ON public.stock_universe FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can insert verification debug logs" ON public.verification_debug_logs;
CREATE POLICY "Service role can insert verification debug logs" ON public.verification_debug_logs FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can manage app settings" ON public.app_settings;
CREATE POLICY "Service role can manage app settings" ON public.app_settings USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can manage seed progress" ON public.seed_job_progress;
CREATE POLICY "Service role can manage seed progress" ON public.seed_job_progress USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state" ON public.email_send_state USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON public.user_subscriptions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
CREATE POLICY "Service role can read send log" ON public.email_send_log FOR SELECT USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails FOR SELECT USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens FOR SELECT USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can read verification debug logs" ON public.verification_debug_logs;
CREATE POLICY "Service role can read verification debug logs" ON public.verification_debug_logs FOR SELECT USING ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can update cached prices" ON public.cached_stock_prices;
CREATE POLICY "Service role can update cached prices" ON public.cached_stock_prices FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can update sector cache" ON public.sector_cache;
CREATE POLICY "Service role can update sector cache" ON public.sector_cache FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can update universe" ON public.stock_universe;
CREATE POLICY "Service role can update universe" ON public.stock_universe FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS "Users can add their own favourites" ON public.user_favourites;
CREATE POLICY "Users can add their own favourites" ON public.user_favourites FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own favourites" ON public.user_favourites;
CREATE POLICY "Users can delete their own favourites" ON public.user_favourites FOR DELETE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own holdings" ON public.portfolio_holdings;
CREATE POLICY "Users can delete their own holdings" ON public.portfolio_holdings FOR DELETE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own review" ON public.app_reviews;
CREATE POLICY "Users can delete their own review" ON public.app_reviews FOR DELETE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own watchlists" ON public.user_watchlists;
CREATE POLICY "Users can delete their own watchlists" ON public.user_watchlists FOR DELETE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own holdings" ON public.portfolio_holdings;
CREATE POLICY "Users can insert their own holdings" ON public.portfolio_holdings FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own review" ON public.app_reviews;
CREATE POLICY "Users can insert their own review" ON public.app_reviews FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (is_approved = false)));

DROP POLICY IF EXISTS "Users can insert their own watchlists" ON public.user_watchlists;
CREATE POLICY "Users can insert their own watchlists" ON public.user_watchlists FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can read their own reviews" ON public.app_reviews;
CREATE POLICY "Users can read their own reviews" ON public.app_reviews FOR SELECT TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own favourites" ON public.user_favourites;
CREATE POLICY "Users can update their own favourites" ON public.user_favourites FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own holdings" ON public.portfolio_holdings;
CREATE POLICY "Users can update their own holdings" ON public.portfolio_holdings FOR UPDATE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own review" ON public.app_reviews;
CREATE POLICY "Users can update their own review" ON public.app_reviews FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (is_approved = false)));

DROP POLICY IF EXISTS "Users can update their own watchlists" ON public.user_watchlists;
CREATE POLICY "Users can update their own watchlists" ON public.user_watchlists FOR UPDATE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own favourites" ON public.user_favourites;
CREATE POLICY "Users can view their own favourites" ON public.user_favourites FOR SELECT TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own holdings" ON public.portfolio_holdings;
CREATE POLICY "Users can view their own holdings" ON public.portfolio_holdings FOR SELECT TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.user_subscriptions FOR SELECT TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own watchlists" ON public.user_watchlists;
CREATE POLICY "Users can view their own watchlists" ON public.user_watchlists FOR SELECT TO authenticated USING ((auth.uid() = user_id));

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cached_stock_prices ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sector_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.seed_job_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shared_watchlists ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_price_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_universe ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_favourites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.verification_debug_logs ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA private TO authenticated;

GRANT USAGE ON SCHEMA public TO postgres;

GRANT USAGE ON SCHEMA public TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT USAGE ON SCHEMA public TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT USAGE ON SCHEMA public TO sandbox_exec;

REVOKE ALL ON FUNCTION private.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;

GRANT ALL ON FUNCTION private.has_role(_user_id uuid, _role public.app_role) TO service_role;

GRANT ALL ON FUNCTION private.has_role(_user_id uuid, _role public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_email(queue_name text, message_id bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION public.delete_email(queue_name text, message_id bigint) TO service_role;

GRANT ALL ON FUNCTION public.delete_email(queue_name text, message_id bigint) TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.delete_email(queue_name text, message_id bigint) TO sandbox_exec;

REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC;

GRANT ALL ON FUNCTION public.email_queue_dispatch() TO service_role;

GRANT ALL ON FUNCTION public.email_queue_dispatch() TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.email_queue_dispatch() TO sandbox_exec;

REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC;

GRANT ALL ON FUNCTION public.email_queue_wake() TO service_role;

GRANT ALL ON FUNCTION public.email_queue_wake() TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.email_queue_wake() TO sandbox_exec;

REVOKE ALL ON FUNCTION public.enforce_watchlist_quota() FROM PUBLIC;

GRANT ALL ON FUNCTION public.enforce_watchlist_quota() TO service_role;

GRANT ALL ON FUNCTION public.enforce_watchlist_quota() TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.enforce_watchlist_quota() TO sandbox_exec;

REVOKE ALL ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) TO service_role;

GRANT ALL ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) TO sandbox_exec;

REVOKE ALL ON FUNCTION public.handle_new_subscription() FROM PUBLIC;

GRANT ALL ON FUNCTION public.handle_new_subscription() TO service_role;

GRANT ALL ON FUNCTION public.handle_new_subscription() TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.handle_new_subscription() TO sandbox_exec;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

GRANT ALL ON FUNCTION public.handle_new_user() TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.handle_new_user() TO sandbox_exec;

REVOKE ALL ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) TO service_role;

GRANT ALL ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) TO sandbox_exec;

REVOKE ALL ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) FROM PUBLIC;

GRANT ALL ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) TO service_role;

GRANT ALL ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) TO sandbox_exec;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;

GRANT ALL ON FUNCTION public.update_updated_at_column() TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT ALL ON FUNCTION public.update_updated_at_column() TO sandbox_exec;

GRANT ALL ON TABLE public.app_reviews TO anon;

GRANT ALL ON TABLE public.app_reviews TO authenticated;

GRANT ALL ON TABLE public.app_reviews TO service_role;

GRANT SELECT,INSERT ON TABLE public.app_reviews TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.app_reviews TO sandbox_exec;

GRANT ALL ON TABLE public.app_settings TO anon;

GRANT ALL ON TABLE public.app_settings TO authenticated;

GRANT ALL ON TABLE public.app_settings TO service_role;

GRANT SELECT,INSERT ON TABLE public.app_settings TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.app_settings TO sandbox_exec;

GRANT ALL ON TABLE public.cached_stock_prices TO anon;

GRANT ALL ON TABLE public.cached_stock_prices TO authenticated;

GRANT ALL ON TABLE public.cached_stock_prices TO service_role;

GRANT SELECT,INSERT ON TABLE public.cached_stock_prices TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.cached_stock_prices TO sandbox_exec;

GRANT ALL ON TABLE public.email_send_log TO anon;

GRANT ALL ON TABLE public.email_send_log TO authenticated;

GRANT ALL ON TABLE public.email_send_log TO service_role;

GRANT SELECT,INSERT ON TABLE public.email_send_log TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.email_send_log TO sandbox_exec;

GRANT ALL ON TABLE public.email_send_state TO anon;

GRANT ALL ON TABLE public.email_send_state TO authenticated;

GRANT ALL ON TABLE public.email_send_state TO service_role;

GRANT SELECT,INSERT ON TABLE public.email_send_state TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.email_send_state TO sandbox_exec;

GRANT ALL ON TABLE public.email_unsubscribe_tokens TO anon;

GRANT ALL ON TABLE public.email_unsubscribe_tokens TO authenticated;

GRANT ALL ON TABLE public.email_unsubscribe_tokens TO service_role;

GRANT SELECT,INSERT ON TABLE public.email_unsubscribe_tokens TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.email_unsubscribe_tokens TO sandbox_exec;

GRANT ALL ON TABLE public.portfolio_holdings TO anon;

GRANT ALL ON TABLE public.portfolio_holdings TO authenticated;

GRANT ALL ON TABLE public.portfolio_holdings TO service_role;

GRANT SELECT,INSERT ON TABLE public.portfolio_holdings TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.portfolio_holdings TO sandbox_exec;

GRANT ALL ON TABLE public.profiles TO anon;

GRANT ALL ON TABLE public.profiles TO authenticated;

GRANT ALL ON TABLE public.profiles TO service_role;

GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec;

GRANT ALL ON TABLE public.sector_cache TO anon;

GRANT ALL ON TABLE public.sector_cache TO authenticated;

GRANT ALL ON TABLE public.sector_cache TO service_role;

GRANT SELECT,INSERT ON TABLE public.sector_cache TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.sector_cache TO sandbox_exec;

GRANT ALL ON TABLE public.seed_job_progress TO anon;

GRANT ALL ON TABLE public.seed_job_progress TO authenticated;

GRANT ALL ON TABLE public.seed_job_progress TO service_role;

GRANT SELECT,INSERT ON TABLE public.seed_job_progress TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.seed_job_progress TO sandbox_exec;

GRANT ALL ON TABLE public.shared_watchlists TO anon;

GRANT ALL ON TABLE public.shared_watchlists TO authenticated;

GRANT ALL ON TABLE public.shared_watchlists TO service_role;

GRANT SELECT,INSERT ON TABLE public.shared_watchlists TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.shared_watchlists TO sandbox_exec;

GRANT ALL ON TABLE public.stock_price_history TO anon;

GRANT ALL ON TABLE public.stock_price_history TO authenticated;

GRANT ALL ON TABLE public.stock_price_history TO service_role;

GRANT SELECT,INSERT ON TABLE public.stock_price_history TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.stock_price_history TO sandbox_exec;

GRANT ALL ON SEQUENCE public.stock_price_history_id_seq TO anon;

GRANT ALL ON SEQUENCE public.stock_price_history_id_seq TO authenticated;

GRANT ALL ON SEQUENCE public.stock_price_history_id_seq TO service_role;

GRANT SELECT,USAGE ON SEQUENCE public.stock_price_history_id_seq TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,USAGE ON SEQUENCE public.stock_price_history_id_seq TO sandbox_exec;

GRANT ALL ON TABLE public.stock_universe TO anon;

GRANT ALL ON TABLE public.stock_universe TO authenticated;

GRANT ALL ON TABLE public.stock_universe TO service_role;

GRANT SELECT,INSERT ON TABLE public.stock_universe TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.stock_universe TO sandbox_exec;

GRANT ALL ON SEQUENCE public.stock_universe_id_seq TO anon;

GRANT ALL ON SEQUENCE public.stock_universe_id_seq TO authenticated;

GRANT ALL ON SEQUENCE public.stock_universe_id_seq TO service_role;

GRANT SELECT,USAGE ON SEQUENCE public.stock_universe_id_seq TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,USAGE ON SEQUENCE public.stock_universe_id_seq TO sandbox_exec;

GRANT ALL ON TABLE public.suppressed_emails TO anon;

GRANT ALL ON TABLE public.suppressed_emails TO authenticated;

GRANT ALL ON TABLE public.suppressed_emails TO service_role;

GRANT SELECT,INSERT ON TABLE public.suppressed_emails TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.suppressed_emails TO sandbox_exec;

GRANT ALL ON TABLE public.user_favourites TO anon;

GRANT ALL ON TABLE public.user_favourites TO authenticated;

GRANT ALL ON TABLE public.user_favourites TO service_role;

GRANT SELECT,INSERT ON TABLE public.user_favourites TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.user_favourites TO sandbox_exec;

GRANT ALL ON TABLE public.user_preferences TO anon;

GRANT ALL ON TABLE public.user_preferences TO authenticated;

GRANT ALL ON TABLE public.user_preferences TO service_role;

GRANT SELECT,INSERT ON TABLE public.user_preferences TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.user_preferences TO sandbox_exec;

GRANT ALL ON TABLE public.user_roles TO anon;

GRANT ALL ON TABLE public.user_roles TO authenticated;

GRANT ALL ON TABLE public.user_roles TO service_role;

GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;

GRANT ALL ON TABLE public.user_subscriptions TO anon;

GRANT ALL ON TABLE public.user_subscriptions TO authenticated;

GRANT ALL ON TABLE public.user_subscriptions TO service_role;

GRANT SELECT,INSERT ON TABLE public.user_subscriptions TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.user_subscriptions TO sandbox_exec;

GRANT ALL ON TABLE public.user_watchlists TO anon;

GRANT ALL ON TABLE public.user_watchlists TO authenticated;

GRANT ALL ON TABLE public.user_watchlists TO service_role;

GRANT SELECT,INSERT ON TABLE public.user_watchlists TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.user_watchlists TO sandbox_exec;

GRANT ALL ON TABLE public.verification_debug_logs TO anon;

GRANT ALL ON TABLE public.verification_debug_logs TO authenticated;

GRANT ALL ON TABLE public.verification_debug_logs TO service_role;

GRANT SELECT,INSERT ON TABLE public.verification_debug_logs TO sandbox_exec_szkezahvdumeiqmnlugj;

GRANT SELECT,INSERT ON TABLE public.verification_debug_logs TO sandbox_exec;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec_szkezahvdumeiqmnlugj;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO sandbox_exec_szkezahvdumeiqmnlugj;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO sandbox_exec;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec_szkezahvdumeiqmnlugj;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- ---------------------------------------------------------------------
-- Auth hooks (auth schema).
-- These live outside the public schema, so they are recreated here for
-- self-hosted / non-Lovable Postgres instances. They provision a profile,
-- default preferences and a trial subscription for every new user.
-- Skip this block if your platform manages auth triggers for you.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

-- Singleton rows the email pipeline expects.
INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seed_job_progress (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
