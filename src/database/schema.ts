// Kysely 数据库 Schema 定义 (PostgreSQL/TimescaleDB)
import type { ColumnType } from "kysely";

// Systems 表
export interface SystemsTable {
    id: string;
    name: string;
    description: string | null;
    api_key: string;
    status: "active" | "inactive";
    created_at: Date;
    updated_at: Date;
}

// Runs 表 (Hypertable)
export interface RunsTable {
    id: string;
    trace_id: string | null;
    name: string | null;
    run_type: string | null;
    system: string | null;
    thread_id: string | null;
    user_id: string | null;
    start_time: Date | null;
    end_time: Date | null;
    inputs: string | null;  // JSON string
    outputs: string | null;  // JSON string
    events: string | null;  // JSON string
    error: string | null;  // JSON string
    extra: string | null;  // JSON string
    serialized: string | null;  // JSON string
    total_tokens: number;
    model_name: string | null;
    time_to_first_token: number;
    tags: string | null;  // JSON array string
    created_at: Date;
    updated_at: Date;
}

// Feedback 表
export interface FeedbackTable {
    id: string;
    trace_id: string;
    run_id: string;
    feedback_id: string | null;
    score: number | null;
    comment: string | null;
    metadata: string | null;  // JSON string
    created_at: Date;
}

// Attachments 表
export interface AttachmentsTable {
    id: string;
    run_id: string;
    filename: string;
    content_type: string | null;
    file_size: number | null;
    storage_path: string | null;
    created_at: Date;
}

// Run Stats Raw 表 (原始统计数据 - 用于连续聚合)
export interface RunStatsRawTable {
    id: string;
    stat_hour: Date;
    model_name: string | null;
    system: string;
    run_id: string;
    duration_ms: number | null;
    token_count: number;
    ttft_ms: number | null;
    is_success: boolean;
    user_id: string | null;
}

// Run Stats Hourly 表 (连续聚合视图)
export interface RunStatsHourlyTable {
    stat_hour: Date;
    model_name: string | null;
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

// Run Stats 15min 表 (连续聚合视图)
export interface RunStats15MinTable {
    stat_period: Date;
    model_name: string | null;
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

// Run Stats Daily 表 (连续聚合视图)
export interface RunStatsDailyTable {
    stat_period: Date;
    model_name: string | null;
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

// Run Stats Weekly 表 (连续聚合视图)
export interface RunStatsWeeklyTable {
    stat_period: Date;
    model_name: string | null;
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

// Run Stats Monthly 表 (连续聚合视图)
export interface RunStatsMonthlyTable {
    stat_period: Date;
    model_name: string | null;
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
    run_stats_raw: RunStatsRawTable;
    run_stats_hourly: RunStatsHourlyTable;
    run_stats_15min: RunStats15MinTable;
    run_stats_daily: RunStatsDailyTable;
    run_stats_weekly: RunStatsWeeklyTable;
    run_stats_monthly: RunStatsMonthlyTable;
}
