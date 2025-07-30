import type { DatabaseAdapter } from "./interfaces.js";

export class BaseDatabase {
    protected adapter: DatabaseAdapter;

    constructor(adapter: DatabaseAdapter) {
        this.adapter = adapter;
    }

    // 初始化方法，需要在使用数据库前调用
    async init(): Promise<void> {
        await this.initTables();
    }

    // 初始化数据库表结构
    private async initTables(): Promise<void> {
        // 创建 systems 表
        await this.adapter.exec(`
            CREATE TABLE IF NOT EXISTS systems (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                api_key TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);

        // 创建 runs 表
        await this.adapter.exec(`
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                trace_id TEXT,
                name TEXT,
                run_type TEXT,
                system TEXT,
                thread_id TEXT,
                user_id TEXT,
                start_time TEXT,
                end_time TEXT,
                inputs TEXT,
                outputs TEXT,
                events TEXT,
                error TEXT,
                extra TEXT,
                serialized TEXT,
                total_tokens INTEGER DEFAULT 0,
                model_name TEXT,
                time_to_first_token INTEGER DEFAULT 0,
                tags TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (system) REFERENCES systems (name)
            )
        `);

        // 创建 feedback 表
        await this.adapter.exec(`
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                trace_id TEXT NOT NULL,
                run_id TEXT NOT NULL,
                feedback_id TEXT,
                score REAL,
                comment TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES runs (id)
            )
        `);

        // 创建 attachments 表
        await this.adapter.exec(`
            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                content_type TEXT,
                file_size INTEGER,
                storage_path TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES runs (id)
            )
        `);

        // 创建索引
        await this.adapter.exec(`
            CREATE INDEX IF NOT EXISTS idx_systems_name ON systems (name);
            CREATE INDEX IF NOT EXISTS idx_systems_api_key ON systems (api_key);
            CREATE INDEX IF NOT EXISTS idx_systems_status ON systems (status);
            CREATE INDEX IF NOT EXISTS idx_runs_trace_id ON runs (trace_id);
            CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs (thread_id);
            CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs (user_id);
            CREATE INDEX IF NOT EXISTS idx_runs_model_name ON runs (model_name);
            CREATE INDEX IF NOT EXISTS idx_runs_system ON runs (system);
            CREATE INDEX IF NOT EXISTS idx_runs_run_type ON runs (run_type);
            CREATE INDEX IF NOT EXISTS idx_feedback_trace_id ON feedback (trace_id);
            CREATE INDEX IF NOT EXISTS idx_feedback_run_id ON feedback (run_id);
            CREATE INDEX IF NOT EXISTS idx_attachments_run_id ON attachments (run_id);
        `);

        // 创建 run_stats_hourly 表
        await this.adapter.exec(`
            CREATE TABLE IF NOT EXISTS run_stats_hourly (
                stat_hour TEXT NOT NULL,
                model_name TEXT,
                system TEXT,
                total_runs INTEGER NOT NULL DEFAULT 0,
                successful_runs INTEGER NOT NULL DEFAULT 0,
                failed_runs INTEGER NOT NULL DEFAULT 0,
                error_rate REAL,
                total_duration_ms BIGINT,
                avg_duration_ms INTEGER,
                p95_duration_ms INTEGER,
                p99_duration_ms INTEGER,
                total_tokens_sum BIGINT,
                avg_tokens_per_run REAL,
                avg_ttft_ms INTEGER,
                p95_ttft_ms INTEGER,
                distinct_users INTEGER,
                PRIMARY KEY (stat_hour, model_name, system)
            )
        `);

        await this.adapter.exec(`
            CREATE INDEX IF NOT EXISTS idx_run_stats_hourly_time ON run_stats_hourly (stat_hour);
        `);
    }

    // 事务操作
    async createTransaction<T extends any[], R>(
        fn: (...args: T) => Promise<R>
    ): Promise<(...args: T) => Promise<R>> {
        return await this.adapter.transaction(fn);
    }

    async close(): Promise<void> {
        return await this.adapter.close();
    }
}
