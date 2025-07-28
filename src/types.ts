/** 此文件定义前后端一致的类型声明 */

/** Run 的基本类型 */
export interface BaseRunRecord {
    id: string;
    trace_id?: string;
    name: string;
    run_type?: string;
    system?: string; // 系统标识，来自 x-api-key
    thread_id?: string; // 线程ID，来自 extra.metadata.thread_id
    user_id?: string; // 用户ID，来自 extra.metadata.user_id
    start_time: string;
    end_time: string;
    inputs?: string; // JSON string
    outputs?: string; // JSON string
    events?: string; // JSON string
    error?: string; // JSON string
    extra?: string; // JSON string
    serialized?: string; // JSON string
    total_tokens?: number; // 新增字段：总 token 数
    model_name?: string; // 新增字段：模型名称
    time_to_first_token?: number; // 新增字段：首个 token 时间
    tags?: string; // 新增字段：标签数组，存储为JSON字符串
    created_at: string;
    updated_at: string;
}

export interface RunRecord extends BaseRunRecord {
    feedback_count: number;
    attachments_count: number;
    feedback: FeedbackRecord[];
    attachments: AttachmentRecord[];
}

export interface RunRecordExtra {
    extra: {};
}

export interface FeedbackRecord {
    id: string;
    trace_id: string;
    run_id: string;
    feedback_id?: string;
    score?: number;
    comment?: string;
    metadata?: string; // JSON string
    created_at: string;
}

export interface AttachmentRecord {
    id: string;
    run_id: string;
    filename: string;
    content_type: string;
    file_size: number;
    storage_path: string;
    created_at: string;
}

export interface SystemRecord {
    id: string;
    name: string; // 系统名称，与runs表的system字段关联
    description?: string; // 系统描述
    api_key: string; // API密钥
    status: "active" | "inactive"; // 系统状态
    created_at: string;
    updated_at: string;
}

/** Trace 的基本定义类型 */
export interface TraceOverview {
    thread_id?: string;
    trace_id: string;
    total_runs: number;
    total_feedback: number;
    total_attachments: number;
    first_run_time: string;
    last_run_time: string;
    run_types: string[];
    systems: string[]; // 涉及的系统列表
    total_tokens_sum?: number; // 新增：总 token 消耗量
    user_id?: string; // 新增：用户ID
}

export type RunStatsHourlyRecord = {
    stat_hour: string;
    model_name: string | null;
    system: string | null;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    error_rate: number;
    total_duration_ms: number;
    avg_duration_ms: number;
    p95_duration_ms: number;
    p99_duration_ms: number;
    total_tokens_sum: number;
    avg_tokens_per_run: number;
    avg_ttft_ms: number;
    p95_ttft_ms: number;
    distinct_users: number;
};

export interface TraceInfo {
    trace_id: string;
    total_runs: number;
    total_feedback: number;
    total_attachments: number;
    first_run_time: string;
    last_run_time: string;
    runs: RunRecord[];
}

export type { MessagesTemplate } from "./routes/llm-routes.js";

export type { ModelConfig } from "./routes/llm-routes.js";
