// Kysely 数据库 Schema 定义
import type { ColumnType } from "kysely";

// Systems 表
export interface SystemsTable {
    id: string;
    name: string;
    description: string | null;
    api_key: string;
    status: "active" | "inactive";
    created_at: string;
    updated_at: string;
}

// Runs 表
export interface RunsTable {
    id: string;
    trace_id: string | null;
    name: string | null;
    run_type: string | null;
    system: string | null;
    thread_id: string | null;
    user_id: string | null;
    start_time: string | null;
    end_time: string | null;
    inputs: string | null;
    outputs: string | null;
    events: string | null;
    error: string | null;
    extra: string | null;
    serialized: string | null;
    total_tokens: number;
    model_name: string | null;
    time_to_first_token: number;
    tags: string | null;
    created_at: string;
    updated_at: string;
}

// Feedback 表
export interface FeedbackTable {
    id: string;
    trace_id: string;
    run_id: string;
    feedback_id: string | null;
    score: number | null;
    comment: string | null;
    metadata: string | null;
    created_at: string;
}

// Attachments 表
export interface AttachmentsTable {
    id: string;
    run_id: string;
    filename: string;
    content_type: string | null;
    file_size: number | null;
    storage_path: string | null;
    created_at: string;
}

// Run Stats Hourly 表
export interface RunStatsHourlyTable {
    stat_hour: string;
    model_name: string;
    system: string | null;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    error_rate: number | null;
    total_duration_ms: number | null;
    avg_duration_ms: number | null;
    p95_duration_ms: number | null;
    p99_duration_ms: number | null;
    total_tokens_sum: number | null;
    avg_tokens_per_run: number | null;
    avg_ttft_ms: number | null;
    p95_ttft_ms: number | null;
    distinct_users: number | null;
}

// 数据库接口
export interface Database {
    systems: SystemsTable;
    runs: RunsTable;
    feedback: FeedbackTable;
    attachments: AttachmentsTable;
    run_stats_hourly: RunStatsHourlyTable;
}
