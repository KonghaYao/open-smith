-- public.systems definition

-- Drop table

-- DROP TABLE public.systems;

CREATE TABLE public.systems (
	id text NOT NULL,
	"name" text NOT NULL,
	description text NULL,
	api_key text NOT NULL,
	status text NOT NULL DEFAULT 'active'::text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	CONSTRAINT systems_api_key_key UNIQUE (api_key),
	CONSTRAINT systems_name_key UNIQUE (name),
	CONSTRAINT systems_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_systems_api_key ON public.systems USING btree (api_key);
CREATE INDEX idx_systems_name ON public.systems USING btree (name);
CREATE INDEX idx_systems_status ON public.systems USING btree (status);


-- public.runs definition

-- Drop table

-- DROP TABLE public.runs;

CREATE TABLE public.runs (
	id text NOT NULL,
	trace_id text NULL,
	"name" text NULL,
	run_type text NULL,
	"system" text NULL,
	thread_id text NULL,
	user_id text NULL,
	start_time text NULL,
	end_time text NULL,
	inputs text NULL,
	outputs text NULL,
	events text NULL,
	error text NULL,
	extra text NULL,
	serialized text NULL,
	total_tokens int4 NULL DEFAULT 0,
	model_name text NULL,
	time_to_first_token int4 NULL DEFAULT 0,
	tags text NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	CONSTRAINT runs_pkey PRIMARY KEY (id),
	CONSTRAINT runs_system_fkey FOREIGN KEY ("system") REFERENCES public.systems("name")
);
CREATE INDEX idx_runs_model_name ON public.runs USING btree (model_name);
CREATE INDEX idx_runs_run_type ON public.runs USING btree (run_type);
CREATE INDEX idx_runs_system ON public.runs USING btree (system);
CREATE INDEX idx_runs_thread_id ON public.runs USING btree (thread_id);
CREATE INDEX idx_runs_trace_id ON public.runs USING btree (trace_id);
CREATE INDEX idx_runs_user_id ON public.runs USING btree (user_id);


-- public.attachments definition

-- Drop table

-- DROP TABLE public.attachments;

CREATE TABLE public.attachments (
	id text NOT NULL,
	run_id text NOT NULL,
	filename text NOT NULL,
	content_type text NULL,
	file_size int4 NULL,
	storage_path text NULL,
	created_at text NOT NULL,
	CONSTRAINT attachments_pkey PRIMARY KEY (id),
	CONSTRAINT attachments_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id)
);
CREATE INDEX idx_attachments_run_id ON public.attachments USING btree (run_id);


-- public.feedback definition

-- Drop table

-- DROP TABLE public.feedback;

CREATE TABLE public.feedback (
	id text NOT NULL,
	trace_id text NOT NULL,
	run_id text NOT NULL,
	feedback_id text NULL,
	score float4 NULL,
	"comment" text NULL,
	metadata text NULL,
	created_at text NOT NULL,
	CONSTRAINT feedback_pkey PRIMARY KEY (id),
	CONSTRAINT feedback_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id)
);
CREATE INDEX idx_feedback_run_id ON public.feedback USING btree (run_id);
CREATE INDEX idx_feedback_trace_id ON public.feedback USING btree (trace_id);