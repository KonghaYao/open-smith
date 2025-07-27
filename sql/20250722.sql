
CREATE TABLE attachments(
    id text NOT NULL,
    run_id text NOT NULL,
    filename text NOT NULL,
    content_type text,
    file_size integer,
    storage_path text,
    created_at text NOT NULL,
    PRIMARY KEY(id),
    CONSTRAINT attachments_run_id_fkey FOREIGN key(run_id) REFERENCES runs(id)
);
CREATE INDEX idx_attachments_run_id ON public.attachments USING btree (run_id);

CREATE TABLE feedback(
    id text NOT NULL,
    trace_id text NOT NULL,
    run_id text NOT NULL,
    feedback_id text,
    score real,
    comment text,
    metadata text,
    created_at text NOT NULL,
    PRIMARY KEY(id),
    CONSTRAINT feedback_run_id_fkey FOREIGN key(run_id) REFERENCES runs(id)
);
CREATE INDEX idx_feedback_trace_id ON public.feedback USING btree (trace_id);
CREATE INDEX idx_feedback_run_id ON public.feedback USING btree (run_id);

CREATE TABLE runs(
    id text NOT NULL,
    trace_id text,
    name text,
    run_type text,
    "system" text,
    thread_id text,
    user_id text,
    start_time text,
    end_time text,
    inputs text,
    outputs text,
    events text,
    error text,
    extra text,
    serialized text,
    total_tokens integer DEFAULT 0,
    model_name text,
    time_to_first_token integer DEFAULT 0,
    tags text,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    PRIMARY KEY(id),
    CONSTRAINT runs_system_fkey FOREIGN key("system") REFERENCES systems(name)
);
CREATE INDEX idx_runs_trace_id ON public.runs USING btree (trace_id);
CREATE INDEX idx_runs_thread_id ON public.runs USING btree (thread_id);
CREATE INDEX idx_runs_user_id ON public.runs USING btree (user_id);
CREATE INDEX idx_runs_model_name ON public.runs USING btree (model_name);
CREATE INDEX idx_runs_system ON public.runs USING btree (system);
CREATE INDEX idx_runs_run_type ON public.runs USING btree (run_type);

CREATE TABLE systems(
    id text NOT NULL,
    name text NOT NULL,
    description text,
    api_key text NOT NULL,
    status text NOT NULL DEFAULT 'active'::text,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    PRIMARY KEY(id)
);
CREATE UNIQUE INDEX systems_name_key ON public.systems USING btree (name);
CREATE UNIQUE INDEX systems_api_key_key ON public.systems USING btree (api_key);
CREATE INDEX idx_systems_name ON public.systems USING btree (name);
CREATE INDEX idx_systems_api_key ON public.systems USING btree (api_key);
CREATE INDEX idx_systems_status ON public.systems USING btree (status);