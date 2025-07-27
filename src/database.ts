import { v4 as uuidv4 } from "uuid";
import type { RunPayload, FeedbackPayload } from "./multipart-types.js";

const formatTimestamp = (time: string | void) => {
    if (time) {
        return new Date(time).getTime().toFixed(0);
    }
    return;
};

export interface RunRecord {
    id: string;
    trace_id?: string;
    name?: string;
    run_type?: string;
    system?: string; // 系统标识，来自 x-api-key
    thread_id?: string; // 线程ID，来自 extra.metadata.thread_id
    user_id?: string; // 用户ID，来自 extra.metadata.user_id
    start_time?: string;
    end_time?: string;
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

export interface TraceOverview {
    trace_id: string;
    total_runs: number;
    total_feedback: number;
    total_attachments: number;
    first_run_time: string;
    last_run_time: string;
    run_types: string[];
    systems: string[]; // 涉及的系统列表
    total_tokens_sum?: number; // 新增：总 token 消耗量
}

// 数据库适配器接口
export interface DatabaseAdapter {
    exec(sql: string): Promise<void>;
    prepare(sql: string): Promise<PreparedStatement>;
    transaction<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
    ): Promise<(...args: T) => Promise<R>>;
    close(): Promise<void>;
    getStringAggregateFunction(
        column: string,
        distinct: boolean,
        delimiter: string,
    ): string;
    getPlaceholder(index: number): string;
}

// 预处理语句接口
export interface PreparedStatement {
    run(params?: any[]): Promise<{ changes: number }>;
    get(params?: any): Promise<any>;
    all(params?: any): Promise<any[]>;
}

export class TraceDatabase {
    private adapter: DatabaseAdapter;

    constructor(adapter: DatabaseAdapter) {
        this.adapter = adapter;
        // 注意：构造函数中不能直接调用异步方法
        // 需要在使用前调用 init() 方法
    }

    // 初始化方法，需要在使用数据库前调用
    async init(): Promise<void> {
        await this.initTables();
    }

    // 从 outputs 字段中提取 total_tokens 的辅助方法
    private extractTotalTokensFromOutputs(outputs?: string | object): number {
        if (!outputs) return 0;
        try {
            const outputData =
                typeof outputs === "string" ? JSON.parse(outputs) : outputs;

            if (outputData?.llmOutput?.tokenUsage) {
                const result = outputData.llmOutput.tokenUsage.totalTokens;
                if (result === null || result === undefined) {
                    // 如果 totalTokens 为 null 或 undefined，则赋值为 5
                }
                return result || 0;
            } else if (outputData.generations) {
                return outputData.generations.reduce(
                    (col: number, cur: any) => {
                        const sum = cur
                            .map((i: any) => i.message)
                            .reduce((sum: number, i: any) => {
                                return (
                                    sum +
                                    (i?.kwargs?.usage_metadata?.total_tokens ||
                                        0)
                                );
                            }, 0);
                        return col + sum;
                    },
                    0,
                );
            }
        } catch (error) {
            console.warn("解析 outputs 提取 total_tokens 时出错:", error);
        }
        return 0;
    }

    // 从 events 字段中提取 time_to_first_token 的辅助方法
    private extractTimeToFirstTokenFromEvents(
        events?: string | object,
    ): number {
        if (!events) return 0;
        try {
            const eventsData =
                typeof events === "string" ? JSON.parse(events) : events;
            if (Array.isArray(eventsData) && eventsData.length >= 2) {
                const firstEventTime = new Date(eventsData[0].time).getTime();
                const secondEventTime = new Date(eventsData[1].time).getTime();
                return secondEventTime - firstEventTime;
            }
        } catch (error) {
            console.warn("解析 events 提取 time_to_first_token 时出错:", error);
        }
        return 0;
    }

    // 从 outputs 字段中提取 model_name 的辅助方法
    private extractModelNameFromOutputs(
        outputs?: string | object,
    ): string | undefined {
        if (!outputs) return undefined;
        try {
            const outputData =
                typeof outputs === "string" ? JSON.parse(outputs) : outputs;
            const outputGenerations = outputData?.generations?.[0]?.[0];
            const model_name = (
                outputGenerations?.generationInfo ||
                outputGenerations?.generation_info
            )?.model_name;
            if (model_name) {
                return model_name;
            } else {
                const data = outputGenerations?.message?.kwargs;
                return (data?.response_metadata || data?.responseMetadata)
                    ?.model_name;
            }
        } catch (error) {
            console.warn("解析 outputs 提取 model_name 时出错:", error);
            return undefined;
        }
    }

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
    }

    // 从 extra 字段中提取 thread_id 的辅助方法
    private extractThreadIdFromExtra(extra: any): string | undefined {
        if (!extra) return undefined;

        try {
            const extraData =
                typeof extra === "string" ? JSON.parse(extra) : extra;
            return extraData?.metadata?.thread_id;
        } catch (error) {
            return undefined;
        }
    }

    // 从 extra 字段中提取 user_id 的辅助方法
    private extractUserIdFromExtra(extra: any): string | undefined {
        if (!extra) return undefined;

        try {
            const extraData =
                typeof extra === "string" ? JSON.parse(extra) : extra;
            return extraData?.metadata?.user_id;
        } catch (error) {
            return undefined;
        }
    }

    // 获取所有 traceId 及其概要信息
    async getAllTraces(): Promise<TraceOverview[]> {
        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(created_at) as first_run_time,
                MAX(created_at) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ",",
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ",",
                )} as systems,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            WHERE trace_id IS NOT NULL 
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
        `);

        const traces = (await stmt.all()) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1,
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                };
            }),
        );
    }

    // 确保系统存在的辅助方法
    async ensureSystemExists(systemName: string): Promise<SystemRecord> {
        if (!systemName) {
            throw new Error("系统名称不能为空");
        }

        let system = await this.getSystemByName(systemName);
        if (!system) {
            // 如果系统不存在，自动创建一个
            system = await this.createSystem(
                systemName,
                `自动创建的系统: ${systemName}`,
            );
        }
        return system;
    }

    // Run 操作
    async createRun(runData: RunPayload): Promise<RunRecord> {
        const id = runData.id || uuidv4();
        const now = new Date().toISOString();

        // 如果提供了系统名称，确保系统存在
        if (runData.system) {
            await this.ensureSystemExists(runData.system);
        }

        // 从 extra 中提取 thread_id（如果未直接提供）
        const threadId =
            runData.thread_id || this.extractThreadIdFromExtra(runData.extra);

        // 从 extra 中提取 user_id
        const userId = this.extractUserIdFromExtra(runData.extra);

        const record: RunRecord = {
            id,
            trace_id: runData.trace_id,
            name: runData.name,
            run_type: runData.run_type,
            system: runData.system,
            thread_id: threadId,
            user_id: userId,
            start_time: formatTimestamp(runData.start_time),
            end_time: formatTimestamp(runData.end_time),
            inputs: runData.inputs ? JSON.stringify(runData.inputs) : undefined,
            outputs: runData.outputs
                ? JSON.stringify(runData.outputs)
                : undefined,
            events: runData.events ? JSON.stringify(runData.events) : undefined,
            error: runData.error ? JSON.stringify(runData.error) : undefined,
            extra: runData.extra ? JSON.stringify(runData.extra) : undefined,
            serialized: runData.serialized
                ? JSON.stringify(runData.serialized)
                : undefined,
            created_at: now,
            updated_at: now,
            total_tokens: runData.outputs
                ? this.extractTotalTokensFromOutputs(runData.outputs)
                : 0,
            model_name: runData.outputs
                ? this.extractModelNameFromOutputs(runData.outputs)
                : undefined,
            time_to_first_token: runData.events
                ? this.extractTimeToFirstTokenFromEvents(runData.events)
                : 0,
            tags: (runData as any).tags
                ? (runData as any).tags.join(",")
                : undefined,
        };
        const commitData = [
            record.id,
            record.trace_id,
            record.name,
            record.run_type,
            record.system,
            record.model_name,
            record.thread_id,
            record.user_id,
            record.start_time,
            record.end_time,
            record.inputs,
            record.outputs,
            record.events,
            record.error,
            record.extra,
            record.serialized,
            record.total_tokens,
            record.created_at,
            record.updated_at,
            record.time_to_first_token,
            record.tags,
        ];

        const stmt = await this.adapter.prepare(`
            INSERT INTO runs (
                id, trace_id, name, run_type, system, model_name, thread_id, user_id, start_time, end_time,
                inputs, outputs, events, error, extra, serialized, total_tokens,
                created_at, updated_at, time_to_first_token, tags
            ) VALUES (${commitData
                .map((item, index) => this.adapter.getPlaceholder(index + 1))
                .join(",")})
        `);

        await stmt.run(commitData);

        return record;
    }

    async updateRun(
        runId: string,
        runData: RunPayload,
    ): Promise<RunRecord | null> {
        const now = new Date().toISOString();
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1; // 用于PostgreSQL的参数索引，对于SQLite将是无用的，但逻辑统一

        if (runData.trace_id !== undefined) {
            updateFields.push(
                `trace_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(runData.trace_id);
        }
        if (runData.name !== undefined) {
            updateFields.push(
                `name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(runData.name);
        }
        if (runData.run_type !== undefined) {
            updateFields.push(
                `run_type = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(runData.run_type);
        }
        if (runData.system !== undefined) {
            updateFields.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(runData.system);
        }
        if (runData.start_time !== undefined) {
            updateFields.push(
                `start_time = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(formatTimestamp(runData.start_time));
        }
        if (runData.end_time !== undefined) {
            updateFields.push(
                `end_time = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(formatTimestamp(runData.end_time));
        }
        if (runData.inputs !== undefined) {
            updateFields.push(
                `inputs = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(JSON.stringify(runData.inputs));
        }
        if (runData.outputs !== undefined) {
            updateFields.push(
                `outputs = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(JSON.stringify(runData.outputs));

            // 如果 outputs 被更新，重新计算并更新 total_tokens
            updateFields.push(
                `total_tokens = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(
                this.extractTotalTokensFromOutputs(runData.outputs),
            );

            // 如果 outputs 被更新，重新计算并更新 model_name
            updateFields.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(
                this.extractModelNameFromOutputs(runData.outputs),
            );
        } else if (runData.total_tokens !== undefined) {
            updateFields.push(
                `total_tokens = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(runData.total_tokens);
        }

        // 如果 runData.model_name 存在且 runData.outputs 未定义（即 outputs 未被更新）
        // 并且模型名称需要单独更新，则添加 model_name 到更新字段
        if (runData.model_name !== undefined && runData.outputs === undefined) {
            updateFields.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(runData.model_name);
        }

        if (runData.events !== undefined) {
            updateFields.push(
                `events = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(JSON.stringify(runData.events));
            // 如果 events 被更新，重新计算并更新 time_to_first_token
            updateFields.push(
                `time_to_first_token = ${this.adapter.getPlaceholder(
                    paramIndex++,
                )}`,
            );
            updateValues.push(
                this.extractTimeToFirstTokenFromEvents(runData.events),
            );
        }
        if (runData.error !== undefined) {
            updateFields.push(
                `error = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(JSON.stringify(runData.error));
        }
        if (runData.extra !== undefined) {
            updateFields.push(
                `extra = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(JSON.stringify(runData.extra));

            // 如果更新了 extra 且没有直接提供 thread_id，尝试从 extra 中提取
            if (runData.thread_id === undefined) {
                const threadId = this.extractThreadIdFromExtra(runData.extra);
                if (threadId) {
                    updateFields.push(
                        `thread_id = ${this.adapter.getPlaceholder(
                            paramIndex++,
                        )}`,
                    );
                    updateValues.push(threadId);
                }
            }

            // 从 extra 中提取并更新 user_id
            const userId = this.extractUserIdFromExtra(runData.extra);
            if (userId) {
                updateFields.push(
                    `user_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
                );
                updateValues.push(userId);
            }
        }
        if (runData.thread_id !== undefined) {
            updateFields.push(
                `thread_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(runData.thread_id);
        }
        if (runData.serialized !== undefined) {
            updateFields.push(
                `serialized = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(JSON.stringify(runData.serialized));
        }
        if (runData.total_tokens !== undefined) {
            updateFields.push(
                `total_tokens = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(runData.total_tokens);
        }
        if ((runData as any).tags !== undefined) {
            updateFields.push(
                `tags = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(
                (runData as any).tags ? (runData as any).tags.join(",") : null,
            );
        }

        if (updateFields.length === 0) {
            return this.getRun(runId);
        }

        updateFields.push(
            `updated_at = ${this.adapter.getPlaceholder(paramIndex++)}`,
        );
        updateValues.push(now);
        updateValues.push(runId); // runId 是 WHERE 子句的最后一个参数

        const stmt = await this.adapter.prepare(`
            UPDATE runs SET ${updateFields.join(
                ", ",
            )} WHERE id = ${this.adapter.getPlaceholder(paramIndex)}
        `);

        const result = await stmt.run(updateValues);

        if (result.changes === 0) {
            return null;
        }

        return this.getRun(runId);
    }

    async updateRunField(
        runId: string,
        field: string,
        value: any,
        json = true,
    ): Promise<RunRecord | null> {
        const now = new Date().toISOString();
        const jsonValue = json ? JSON.stringify(value) : value;

        // field = $1, updated_at = $2, WHERE id = $3
        const stmt = await this.adapter.prepare(`
            UPDATE runs SET ${field} = ${this.adapter.getPlaceholder(
            1,
        )}, updated_at = ${this.adapter.getPlaceholder(
            2,
        )} WHERE id = ${this.adapter.getPlaceholder(3)}
        `);

        const result = await stmt.run([jsonValue, now, runId]);

        if (field === "outputs") {
            const total_tokens = this.extractTotalTokensFromOutputs(value);
            await this.updateRunField(runId, "total_tokens", total_tokens);
            const model_name = this.extractModelNameFromOutputs(value);
            await this.updateRunField(runId, "model_name", model_name, false);
        }
        if (field === "events") {
            const time_to_first_token =
                this.extractTimeToFirstTokenFromEvents(value);
            await this.updateRunField(
                runId,
                "time_to_first_token",
                time_to_first_token,
            );
        }
        if (field === "user_id") {
            await this.updateRunField(runId, "user_id", value, false);
        }

        if (result.changes === 0) {
            return null;
        }

        return this.getRun(runId);
    }

    async getRun(runId: string): Promise<RunRecord | null> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM runs WHERE id = ${this.adapter.getPlaceholder(1)}`,
        );
        const result = (await stmt.get([runId])) as RunRecord;
        return result || null;
    }

    // Feedback 操作
    async createFeedback(
        runId: string,
        feedbackData: FeedbackPayload,
    ): Promise<FeedbackRecord> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const record: FeedbackRecord = {
            id,
            trace_id: feedbackData.trace_id,
            run_id: runId,
            feedback_id: feedbackData.feedback_id,
            score: feedbackData.score,
            comment: feedbackData.comment,
            metadata: feedbackData.metadata
                ? JSON.stringify(feedbackData.metadata)
                : undefined,
            created_at: now,
        };

        const stmt = await this.adapter.prepare(`
            INSERT INTO feedback (
                id, trace_id, run_id, feedback_id, score, comment, metadata, created_at
            ) VALUES (${this.adapter.getPlaceholder(
                1,
            )}, ${this.adapter.getPlaceholder(
            2,
        )}, ${this.adapter.getPlaceholder(3)}, ${this.adapter.getPlaceholder(
            4,
        )}, ${this.adapter.getPlaceholder(5)}, ${this.adapter.getPlaceholder(
            6,
        )}, ${this.adapter.getPlaceholder(7)}, ${this.adapter.getPlaceholder(
            8,
        )})
        `);

        await stmt.run([
            record.id,
            record.trace_id,
            record.run_id,
            record.feedback_id,
            record.score,
            record.comment,
            record.metadata,
            record.created_at,
        ]);

        return record;
    }

    // Attachment 操作
    async createAttachment(
        runId: string,
        filename: string,
        contentType: string,
        fileSize: number,
        storagePath: string,
    ): Promise<AttachmentRecord> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const record: AttachmentRecord = {
            id,
            run_id: runId,
            filename,
            content_type: contentType,
            file_size: fileSize,
            storage_path: storagePath,
            created_at: now,
        };

        const stmt = await this.adapter.prepare(`
            INSERT INTO attachments (
                id, run_id, filename, content_type, file_size, storage_path, created_at
            ) VALUES (${this.adapter.getPlaceholder(
                1,
            )}, ${this.adapter.getPlaceholder(
            2,
        )}, ${this.adapter.getPlaceholder(3)}, ${this.adapter.getPlaceholder(
            4,
        )}, ${this.adapter.getPlaceholder(5)}, ${this.adapter.getPlaceholder(
            6,
        )}, ${this.adapter.getPlaceholder(7)})
        `);

        await stmt.run([
            record.id,
            record.run_id,
            record.filename,
            record.content_type,
            record.file_size,
            record.storage_path,
            record.created_at,
        ]);

        return record;
    }

    // 查询操作
    async getRunsByTraceId(traceId: string): Promise<RunRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM runs WHERE trace_id = ${this.adapter.getPlaceholder(
                1,
            )} ORDER BY created_at`,
        );
        return (await stmt.all([traceId])) as RunRecord[];
    }

    // 根据系统过滤获取 traces
    async getTracesBySystem(system: string): Promise<TraceOverview[]> {
        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(start_time) as first_run_time,
                MAX(end_time) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ",",
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ",",
                )} as systems,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            WHERE trace_id IS NOT NULL AND system = ${this.adapter.getPlaceholder(
                1,
            )}
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
        `);

        const traces = (await stmt.all([system])) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1,
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                };
            }),
        );
    }

    // 根据系统获取 runs
    async getRunsBySystem(system: string): Promise<RunRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM runs WHERE system = ${this.adapter.getPlaceholder(
                1,
            )} ORDER BY created_at DESC`,
        );
        return (await stmt.all([system])) as RunRecord[];
    }

    // 根据线程ID获取 runs
    async getRunsByThreadId(threadId: string): Promise<RunRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM runs WHERE thread_id = ${this.adapter.getPlaceholder(
                1,
            )} ORDER BY created_at DESC`,
        );
        return (await stmt.all([threadId])) as RunRecord[];
    }

    // 根据用户ID获取 runs
    async getRunsByUserId(userId: string): Promise<RunRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM runs WHERE user_id = ${this.adapter.getPlaceholder(
                1,
            )} ORDER BY created_at DESC`,
        );
        return (await stmt.all([userId])) as RunRecord[];
    }

    // 根据线程ID获取相关的 traces
    async getTracesByThreadId(threadId: string): Promise<TraceOverview[]> {
        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(start_time) as first_run_time,
                MAX(end_time) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ",",
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ",",
                )} as systems,
                SUM(total_tokens) as total_tokens_sum,
                MIN(user_id) as user_id
            FROM runs 
            WHERE trace_id IS NOT NULL AND thread_id = ${this.adapter.getPlaceholder(
                1,
            )}
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
        `);

        const traces = (await stmt.all([threadId])) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1,
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                    user_id: trace.user_id,
                };
            }),
        );
    }

    // 获取线程ID概览信息 - 统一的查询方法，支持可选过滤条件
    async getThreadOverviews(filters?: {
        system?: string;
        thread_id?: string;
    }): Promise<
        Array<{
            thread_id: string;
            total_runs: number;
            total_traces: number;
            total_feedback: number;
            total_attachments: number;
            first_run_time: string;
            last_run_time: string;
            run_types: string[];
            systems: string[];
            total_tokens_sum: number;
        }>
    > {
        const whereConditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        // 基础条件
        whereConditions.push("thread_id IS NOT NULL AND thread_id != ''");

        // 可选过滤条件
        if (filters?.system) {
            whereConditions.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(filters.system);
        }

        if (filters?.thread_id) {
            whereConditions.push(
                `thread_id LIKE ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(`%${filters.thread_id}%`);
        }

        const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

        const stmt = await this.adapter.prepare(`
            SELECT 
                thread_id,
                COUNT(*) as total_runs,
                COUNT(DISTINCT trace_id) as total_traces,
                MIN(created_at) as first_run_time,
                MAX(created_at) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ",",
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ",",
                )} as systems,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            ${whereClause}
            GROUP BY thread_id 
            ORDER BY MAX(created_at) DESC
        `);

        const threads = (await stmt.all(values)) as any[];

        return Promise.all(
            threads.map(async (thread: any) => {
                // 获取该 thread 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM feedback f
                JOIN runs r ON f.run_id = r.id 
                WHERE r.thread_id = ${this.adapter.getPlaceholder(1)}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.thread_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    thread.thread_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    thread.thread_id,
                ])) as any;

                return {
                    thread_id: thread.thread_id,
                    total_runs: thread.total_runs,
                    total_traces: thread.total_traces,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: thread.first_run_time,
                    last_run_time: thread.last_run_time,
                    run_types: thread.run_types
                        ? thread.run_types.split(",").filter(Boolean)
                        : [],
                    systems: thread.systems
                        ? thread.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: thread.total_tokens_sum || 0,
                };
            }),
        );
    }

    // 获取所有系统列表
    async getAllSystems(): Promise<string[]> {
        const stmt = await this.adapter.prepare(`
            SELECT DISTINCT system 
            FROM runs 
            WHERE system IS NOT NULL AND system != ''
            ORDER BY system
        `);
        const results = (await stmt.all()) as { system: string }[];
        return results.map((r) => r.system);
    }

    // 获取所有线程ID列表
    async getAllThreadIds(): Promise<string[]> {
        const stmt = await this.adapter.prepare(`
            SELECT DISTINCT thread_id 
            FROM runs 
            WHERE thread_id IS NOT NULL AND thread_id != ''
            ORDER BY thread_id
        `);
        const results = (await stmt.all()) as { thread_id: string }[];
        return results.map((r) => r.thread_id);
    }

    // 获取所有用户ID列表
    async getAllUserIds(): Promise<string[]> {
        const stmt = await this.adapter.prepare(`
            SELECT DISTINCT user_id 
            FROM runs 
            WHERE user_id IS NOT NULL AND user_id != ''
            ORDER BY user_id
        `);
        const results = (await stmt.all()) as { user_id: string }[];
        return results.map((r) => r.user_id);
    }

    // 根据用户ID获取相关的 traces
    async getTracesByUserId(userId: string): Promise<TraceOverview[]> {
        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(start_time) as first_run_time,
                MAX(end_time) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ",",
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ",",
                )} as systems,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            WHERE trace_id IS NOT NULL AND user_id = ${this.adapter.getPlaceholder(
                1,
            )}
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
        `);

        const traces = (await stmt.all([userId])) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1,
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                };
            }),
        );
    }

    // 获取所有模型名称列表
    async getAllModelNames(): Promise<string[]> {
        const stmt = await this.adapter.prepare(`
            SELECT DISTINCT model_name 
            FROM runs 
            WHERE model_name IS NOT NULL AND model_name != ''
            ORDER BY model_name
        `);
        const results = (await stmt.all()) as { model_name: string }[];
        return results.map((r) => r.model_name);
    }

    // 获取指定 run_type 的 runs，支持分页
    async getRunsByRunType(
        runType: string,
        limit: number,
        offset: number,
    ): Promise<RunRecord[]> {
        const stmt = await this.adapter.prepare(`
            SELECT * FROM runs
            WHERE run_type = ${this.adapter.getPlaceholder(1)}
            ORDER BY created_at DESC
            LIMIT ${this.adapter.getPlaceholder(
                2,
            )} OFFSET ${this.adapter.getPlaceholder(3)}
        `);
        return (await stmt.all([runType, limit, offset])) as RunRecord[];
    }

    // 获取指定 run_type 的总记录数
    async countRunsByRunType(runType: string): Promise<number> {
        const stmt = await this.adapter.prepare(`
            SELECT COUNT(*) as count
            FROM runs
            WHERE run_type = ${this.adapter.getPlaceholder(1)}
        `);
        const result = (await stmt.get([runType])) as { count: number };
        return result.count || 0;
    }

    // 获取指定条件的 runs，支持分页和多个过滤条件
    async getRunsByConditions(
        conditions: {
            run_type?: string;
            system?: string;
            model_name?: string;
            thread_id?: string;
            user_id?: string;
            tag?: string;
        },
        limit: number,
        offset: number,
    ): Promise<RunRecord[]> {
        const whereConditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (conditions.run_type) {
            whereConditions.push(
                `run_type = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.run_type);
        }
        if (conditions.system) {
            whereConditions.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.system);
        }
        if (conditions.model_name) {
            whereConditions.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.model_name);
        }
        if (conditions.thread_id) {
            whereConditions.push(
                `thread_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.thread_id);
        }
        if (conditions.user_id) {
            whereConditions.push(
                `user_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.user_id);
        }
        if (conditions.tag) {
            whereConditions.push(
                `tags IS NOT NULL AND tags LIKE ${this.adapter.getPlaceholder(
                    paramIndex++,
                )}`,
            );
            values.push(`%"${conditions.tag}"%`);
        }

        const whereClause =
            whereConditions.length > 0
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

        values.push(limit, offset);

        const stmt = await this.adapter.prepare(`
            SELECT * FROM runs
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ${this.adapter.getPlaceholder(paramIndex++)} 
            OFFSET ${this.adapter.getPlaceholder(paramIndex++)}
        `);
        return (await stmt.all(values)) as RunRecord[];
    }

    // 获取指定条件的总记录数
    async countRunsByConditions(conditions: {
        run_type?: string;
        system?: string;
        model_name?: string;
        thread_id?: string;
        user_id?: string;
        tag?: string;
    }): Promise<number> {
        const whereConditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (conditions.user_id) {
            whereConditions.push(
                `user_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.user_id);
        }
        if (conditions.run_type) {
            whereConditions.push(
                `run_type = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.run_type);
        }
        if (conditions.system) {
            whereConditions.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.system);
        }
        if (conditions.model_name) {
            whereConditions.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.model_name);
        }
        if (conditions.thread_id) {
            whereConditions.push(
                `thread_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.thread_id);
        }
        if (conditions.tag) {
            whereConditions.push(
                `tags IS NOT NULL AND tags LIKE ${this.adapter.getPlaceholder(
                    paramIndex++,
                )}`,
            );
            values.push(`%"${conditions.tag}"%`);
        }

        const whereClause =
            whereConditions.length > 0
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

        const stmt = await this.adapter.prepare(`
            SELECT COUNT(*) as count
            FROM runs
            ${whereClause}
        `);
        const result = (await stmt.get(values)) as { count: number };
        return result.count || 0;
    }

    // 获取指定条件的 traces，支持分页和多个过滤条件
    async getTracesByConditions(
        conditions: {
            system?: string;
            thread_id?: string;
            user_id?: string;
            run_type?: string;
            model_name?: string;
        },
        limit: number,
        offset: number,
    ): Promise<TraceOverview[]> {
        const whereConditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (conditions.system) {
            whereConditions.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.system);
        }
        if (conditions.thread_id) {
            whereConditions.push(
                `thread_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.thread_id);
        }
        if (conditions.user_id) {
            whereConditions.push(
                `user_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.user_id);
        }
        if (conditions.run_type) {
            whereConditions.push(
                `run_type = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.run_type);
        }
        if (conditions.model_name) {
            whereConditions.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.model_name);
        }

        const whereClause =
            whereConditions.length > 0
                ? `WHERE trace_id IS NOT NULL AND ${whereConditions.join(
                      " AND ",
                  )}`
                : "WHERE trace_id IS NOT NULL";

        values.push(limit, offset);

        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(created_at) as first_run_time,
                MAX(created_at) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ",",
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ",",
                )} as systems,
                ${this.adapter.getStringAggregateFunction(
                    "user_id",
                    true,
                    ",",
                )} as user_ids,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            ${whereClause}
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
            LIMIT ${this.adapter.getPlaceholder(paramIndex++)} 
            OFFSET ${this.adapter.getPlaceholder(paramIndex++)}
        `);

        const traces = (await stmt.all(values)) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1,
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? Array.from(
                              new Set(
                                  trace.run_types.split(",").filter(Boolean),
                              ),
                          )
                        : [],
                    systems: trace.systems
                        ? Array.from(
                              new Set(trace.systems.split(",").filter(Boolean)),
                          )
                        : [],
                    user_ids: trace.user_ids
                        ? Array.from(
                              new Set(
                                  trace.user_ids.split(",").filter(Boolean),
                              ),
                          )
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                };
            }),
        );
    }

    // 获取指定条件的 traces 总数
    async countTracesByConditions(conditions: {
        system?: string;
        thread_id?: string;
        user_id?: string;
        run_type?: string;
        model_name?: string;
    }): Promise<number> {
        const whereConditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (conditions.system) {
            whereConditions.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.system);
        }
        if (conditions.thread_id) {
            whereConditions.push(
                `thread_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.thread_id);
        }
        if (conditions.user_id) {
            whereConditions.push(
                `user_id = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.user_id);
        }
        if (conditions.run_type) {
            whereConditions.push(
                `run_type = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.run_type);
        }
        if (conditions.model_name) {
            whereConditions.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(conditions.model_name);
        }

        const whereClause =
            whereConditions.length > 0
                ? `WHERE trace_id IS NOT NULL AND ${whereConditions.join(
                      " AND ",
                  )}`
                : "WHERE trace_id IS NOT NULL";

        const stmt = await this.adapter.prepare(`
            SELECT COUNT(DISTINCT trace_id) as count
            FROM runs
            ${whereClause}
        `);
        const result = (await stmt.get(values)) as { count: number };
        return result.count || 0;
    }

    async getFeedbackByRunId(runId: string): Promise<FeedbackRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM feedback WHERE run_id = ${this.adapter.getPlaceholder(
                1,
            )} ORDER BY created_at`,
        );
        return (await stmt.all([runId])) as FeedbackRecord[];
    }

    async getAttachmentsByRunId(runId: string): Promise<AttachmentRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM attachments WHERE run_id = ${this.adapter.getPlaceholder(
                1,
            )} ORDER BY created_at`,
        );
        return (await stmt.all([runId])) as AttachmentRecord[];
    }

    // 事务操作
    async createTransaction<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
    ): Promise<(...args: T) => Promise<R>> {
        return await this.adapter.transaction(fn);
    }

    async close(): Promise<void> {
        return await this.adapter.close();
    }

    // 生成API密钥的辅助方法
    private generateApiKey(): string {
        return `sk-${uuidv4().replace(/-/g, "")}`;
    }

    // 系统管理方法
    async createSystem(
        name: string,
        description?: string,
        apiKey?: string, // 新增：可选的 API Key 参数
    ): Promise<SystemRecord> {
        const id = uuidv4();
        const finalApiKey = apiKey || this.generateApiKey(); // 如果提供了 API Key，则使用它，否则生成新的
        const now = new Date().toISOString();

        const record: SystemRecord = {
            id,
            name,
            description,
            api_key: finalApiKey,
            status: "active",
            created_at: now,
            updated_at: now,
        };

        const stmt = await this.adapter.prepare(`
            INSERT INTO systems (
                id, name, description, api_key, status, created_at, updated_at
            ) VALUES (${this.adapter.getPlaceholder(
                1,
            )}, ${this.adapter.getPlaceholder(
            2,
        )}, ${this.adapter.getPlaceholder(3)}, ${this.adapter.getPlaceholder(
            4,
        )}, ${this.adapter.getPlaceholder(5)}, ${this.adapter.getPlaceholder(
            6,
        )}, ${this.adapter.getPlaceholder(7)})
        `);

        await stmt.run([
            record.id,
            record.name,
            record.description,
            record.api_key,
            record.status,
            record.created_at,
            record.updated_at,
        ]);

        return record;
    }

    async getSystemByApiKey(apiKey: string): Promise<SystemRecord | null> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems WHERE api_key = ${this.adapter.getPlaceholder(
                1,
            )} AND status = 'active'`,
        );
        const result = (await stmt.get([apiKey])) as SystemRecord;
        return result || null;
    }

    async getSystemByName(name: string): Promise<SystemRecord | null> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems WHERE name = ${this.adapter.getPlaceholder(
                1,
            )}`,
        );
        const result = (await stmt.get([name])) as SystemRecord;
        return result || null;
    }

    async getSystemById(id: string): Promise<SystemRecord | null> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems WHERE id = ${this.adapter.getPlaceholder(
                1,
            )}`,
        );
        const result = (await stmt.get([id])) as SystemRecord;
        return result || null;
    }

    async getAllSystemRecords(): Promise<SystemRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems ORDER BY created_at DESC`,
        );
        return (await stmt.all()) as SystemRecord[];
    }

    async getActiveSystems(): Promise<SystemRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems WHERE status = 'active' ORDER BY created_at DESC`,
        );
        return (await stmt.all()) as SystemRecord[];
    }

    async updateSystemStatus(
        id: string,
        status: "active" | "inactive",
    ): Promise<SystemRecord | null> {
        const now = new Date().toISOString();

        const stmt = await this.adapter.prepare(`
            UPDATE systems SET 
                status = ${this.adapter.getPlaceholder(1)}, 
                updated_at = ${this.adapter.getPlaceholder(2)} 
            WHERE id = ${this.adapter.getPlaceholder(3)}
        `);

        const result = await stmt.run([status, now, id]);

        if (result.changes === 0) {
            return null;
        }

        return this.getSystemById(id);
    }

    async updateSystem(
        id: string,
        updates: {
            name?: string;
            description?: string;
            status?: "active" | "inactive";
        },
    ): Promise<SystemRecord | null> {
        const now = new Date().toISOString();
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            updateFields.push(
                `name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(updates.name);
        }
        if (updates.description !== undefined) {
            updateFields.push(
                `description = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(updates.description);
        }
        if (updates.status !== undefined) {
            updateFields.push(
                `status = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(updates.status);
        }

        if (updateFields.length === 0) {
            return this.getSystemById(id);
        }

        updateFields.push(
            `updated_at = ${this.adapter.getPlaceholder(paramIndex++)}`,
        );
        updateValues.push(now);
        updateValues.push(id); // id 是 WHERE 子句的参数

        const stmt = await this.adapter.prepare(`
            UPDATE systems SET ${updateFields.join(
                ", ",
            )} WHERE id = ${this.adapter.getPlaceholder(paramIndex)}
        `);

        const result = await stmt.run(updateValues);

        if (result.changes === 0) {
            return null;
        }

        return this.getSystemById(id);
    }

    async regenerateApiKey(id: string): Promise<SystemRecord | null> {
        const newApiKey = this.generateApiKey();
        const now = new Date().toISOString();

        const stmt = await this.adapter.prepare(`
            UPDATE systems SET 
                api_key = ${this.adapter.getPlaceholder(1)}, 
                updated_at = ${this.adapter.getPlaceholder(2)} 
            WHERE id = ${this.adapter.getPlaceholder(3)}
        `);

        const result = await stmt.run([newApiKey, now, id]);

        if (result.changes === 0) {
            return null;
        }

        return this.getSystemById(id);
    }

    async deleteSystem(id: string): Promise<boolean> {
        const stmt = await this.adapter.prepare(
            `DELETE FROM systems WHERE id = ${this.adapter.getPlaceholder(1)}`,
        );
        const result = await stmt.run([id]);
        return result.changes > 0;
    }

    // 获取系统的运行统计信息
    async getSystemStats(systemName: string): Promise<{
        total_runs: number;
        total_traces: number;
        total_tokens: number;
        total_feedback: number;
        total_attachments: number;
        first_run_time?: string;
        last_run_time?: string;
    }> {
        const runStatsStmt = await this.adapter.prepare(`
            SELECT 
                COUNT(*) as total_runs,
                COUNT(DISTINCT trace_id) as total_traces,
                COALESCE(SUM(total_tokens), 0) as total_tokens,
                MIN(created_at) as first_run_time,
                MAX(created_at) as last_run_time
            FROM runs 
            WHERE system = ${this.adapter.getPlaceholder(1)}
        `);

        const feedbackStatsStmt = await this.adapter.prepare(`
            SELECT COUNT(*) as count 
            FROM feedback f
            JOIN runs r ON f.run_id = r.id 
            WHERE r.system = ${this.adapter.getPlaceholder(1)}
        `);

        const attachmentStatsStmt = await this.adapter.prepare(`
            SELECT COUNT(*) as count 
            FROM attachments a
            JOIN runs r ON a.run_id = r.id 
            WHERE r.system = ${this.adapter.getPlaceholder(1)}
        `);

        const runStats = (await runStatsStmt.get([systemName])) as any;
        const feedbackStats = (await feedbackStatsStmt.get([
            systemName,
        ])) as any;
        const attachmentStats = (await attachmentStatsStmt.get([
            systemName,
        ])) as any;

        return {
            total_runs: runStats.total_runs || 0,
            total_traces: runStats.total_traces || 0,
            total_tokens: runStats.total_tokens || 0,
            total_feedback: feedbackStats.count || 0,
            total_attachments: attachmentStats.count || 0,
            first_run_time: runStats.first_run_time,
            last_run_time: runStats.last_run_time,
        };
    }

    // 数据迁移：为现有的runs记录创建对应的系统记录
    async migrateExistingRunsToSystems(): Promise<{
        created: number;
        skipped: number;
    }> {
        // 获取所有不同的系统名称
        const distinctSystems = await this.getAllSystems();

        let created = 0;
        let skipped = 0;

        for (const systemName of distinctSystems) {
            if (!systemName) continue;

            const existingSystem = await this.getSystemByName(systemName);
            if (!existingSystem) {
                await this.createSystem(
                    systemName,
                    `从现有数据迁移: ${systemName}`,
                );
                created++;
            } else {
                skipped++;
            }
        }

        return { created, skipped };
    }

    // 验证数据一致性：检查是否有runs记录的system字段不存在于systems表中
    async validateSystemReferences(): Promise<string[]> {
        const stmt = await this.adapter.prepare(`
            SELECT DISTINCT r.system 
            FROM runs r 
            LEFT JOIN systems s ON r.system = s.name 
            WHERE r.system IS NOT NULL 
              AND r.system != '' 
              AND s.name IS NULL
        `);

        const result = (await stmt.all()) as { system: string }[];
        return result.map((r) => r.system);
    }
}
