-- public.run_stats_hourly definition
-- Drop table
-- DROP TABLE public.run_stats_hourly;
CREATE TABLE public.run_stats_hourly (
    stat_hour text NOT NULL,
    model_name text NOT NULL,
    "system" text NOT NULL,
    total_runs int4 NOT NULL DEFAULT 0,
    successful_runs int4 NOT NULL DEFAULT 0,
    failed_runs int4 NOT NULL DEFAULT 0,
    error_rate float4 NULL,
    total_duration_ms int8 NULL,
    avg_duration_ms int4 NULL,
    p95_duration_ms int4 NULL,
    p99_duration_ms int4 NULL,
    total_tokens_sum int8 NULL,
    avg_tokens_per_run float4 NULL,
    avg_ttft_ms int4 NULL,
    p95_ttft_ms int4 NULL,
    distinct_users int4 NULL,
    CONSTRAINT run_stats_hourly_pkey PRIMARY KEY (stat_hour, model_name, system)
);
CREATE INDEX idx_run_stats_hourly_time ON public.run_stats_hourly USING btree (stat_hour);