import { v4 as uuidv4 } from "uuid";
import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { RunRecord } from "../../types.js";
import type { RunPayload } from "../../multipart-types.js";
import {
    formatTimestamp,
    extractTotalTokensFromOutputs,
    extractModelNameFromOutputs,
    extractTimeToFirstTokenFromEvents,
    extractThreadIdFromExtra,
    extractUserIdFromExtra,
} from "../utils.js";

export class RunRepository {
    constructor(private db: Kysely<Database>) {}

    // 创建 Run
    async createRun(runData: RunPayload): Promise<RunRecord> {
        const id = runData.id || uuidv4();
        const now = new Date();

        // 从 extra 中提取 thread_id（如果未直接提供）
        const threadId =
            runData.thread_id || extractThreadIdFromExtra(runData.extra);

        // 从 extra 中提取 user_id
        const userId = extractUserIdFromExtra(runData.extra);

        // 格式化时间戳，使用当前时间作为默认值
        const startTime =
            formatTimestamp(runData.start_time) || now.toISOString();
        const endTime = formatTimestamp(runData.end_time) || now.toISOString();

        const record: RunRecord = {
            id,
            trace_id: runData.trace_id,
            name: runData.name!,
            run_type: runData.run_type,
            system: runData.system,
            thread_id: threadId,
            user_id: userId,
            start_time: startTime,
            end_time: endTime,
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
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            total_tokens: runData.outputs
                ? extractTotalTokensFromOutputs(runData.outputs)
                : 0,
            model_name: runData.outputs
                ? extractModelNameFromOutputs(runData.outputs)
                : undefined,
            time_to_first_token: runData.events
                ? extractTimeToFirstTokenFromEvents(runData.events)
                : 0,
            tags: (runData as any).tags
                ? JSON.stringify((runData as any).tags)
                : undefined,
            feedback_count: 0,
            attachments_count: 0,
            feedback: [],
            attachments: [],
        };

        await this.db
            .insertInto("runs")
            .values({
                id: record.id,
                trace_id: record.trace_id ?? null,
                name: record.name ?? null,
                run_type: record.run_type ?? null,
                system: record.system ?? null,
                model_name: record.model_name ?? null,
                thread_id: record.thread_id ?? null,
                user_id: record.user_id ?? null,
                start_time: new Date(record.start_time),
                end_time: new Date(record.end_time),
                inputs: record.inputs ?? null,
                outputs: record.outputs ?? null,
                events: record.events ?? null,
                error: record.error ?? null,
                extra: record.extra ?? null,
                serialized: record.serialized ?? null,
                total_tokens: record.total_tokens ?? 0,
                created_at: now,
                updated_at: now,
                time_to_first_token: record.time_to_first_token ?? 0,
                tags: record.tags ?? null,
            })
            .execute();

        return record;
    }

    // 更新 Run
    async updateRun(
        runId: string,
        runData: RunPayload,
    ): Promise<RunRecord | null> {
        const now = new Date();
        const updateData: Record<string, any> = {};

        if (runData.trace_id !== undefined) {
            updateData.trace_id = runData.trace_id;
        }
        if (runData.name !== undefined) {
            updateData.name = runData.name;
        }
        if (runData.run_type !== undefined) {
            updateData.run_type = runData.run_type;
        }
        if (runData.system !== undefined) {
            updateData.system = runData.system;
        }
        if (runData.start_time !== undefined) {
            const startTime = formatTimestamp(runData.start_time);
            if (startTime) {
                updateData.start_time = new Date(startTime);
            }
        }
        if (runData.end_time !== undefined) {
            const endTime = formatTimestamp(runData.end_time);
            if (endTime) {
                updateData.end_time = new Date(endTime);
            }
        }
        if (runData.inputs !== undefined) {
            updateData.inputs = JSON.stringify(runData.inputs);
            updateData.total_tokens = extractTotalTokensFromOutputs(
                runData.inputs,
            );
            updateData.model_name = extractModelNameFromOutputs(runData.inputs);
        } else if (runData.total_tokens !== undefined) {
            updateData.total_tokens = runData.total_tokens;
        }

        if (runData.model_name !== undefined && runData.inputs === undefined) {
            updateData.model_name = runData.model_name;
        }

        if (runData.events !== undefined) {
            updateData.events = JSON.stringify(runData.events);
            updateData.time_to_first_token = extractTimeToFirstTokenFromEvents(
                runData.events,
            );
        }
        if (runData.error !== undefined) {
            updateData.error = JSON.stringify(runData.error);
        }
        if (runData.extra !== undefined) {
            updateData.extra = JSON.stringify(runData.extra);

            if (runData.thread_id === undefined) {
                const threadId = extractThreadIdFromExtra(runData.extra);
                if (threadId) {
                    updateData.thread_id = threadId;
                }
            }

            const userId = extractUserIdFromExtra(runData.extra);
            if (userId) {
                updateData.user_id = userId;
            }
        }
        if (runData.thread_id !== undefined) {
            updateData.thread_id = runData.thread_id;
        }
        if (runData.serialized !== undefined) {
            updateData.serialized = JSON.stringify(runData.serialized);
        }
        if (runData.total_tokens !== undefined) {
            updateData.total_tokens = runData.total_tokens;
        }
        if ((runData as any).tags !== undefined) {
            updateData.tags = (runData as any).tags
                ? JSON.stringify((runData as any).tags)
                : null;
        }

        if (Object.keys(updateData).length === 0) {
            return this.getRun(runId);
        }

        updateData.updated_at = now;

        const result = await this.db
            .updateTable("runs")
            .set(updateData)
            .where("id", "=", runId)
            .executeTakeFirst();

        if ((result.numUpdatedRows ?? 0n) === 0n) {
            return null;
        }

        return this.getRun(runId);
    }

    // 更新单个字段
    async updateRunField(
        runId: string,
        field: string,
        value: any,
        json = true,
    ): Promise<RunRecord | null> {
        const now = new Date();
        const updateData: Record<string, any> = {
            updated_at: now,
        };

        if (json && value !== null && value !== undefined) {
            updateData[field] = JSON.stringify(value);
        } else {
            updateData[field] = value;
        }

        const result = await this.db
            .updateTable("runs")
            .set(updateData)
            .where("id", "=", runId)
            .executeTakeFirst();

        if ((result.numUpdatedRows ?? 0n) === 0n) {
            return null;
        }

        return this.getRun(runId);
    }

    // 获取单个 Run
    async getRun(runId: string): Promise<RunRecord | null> {
        const run = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("id", "=", runId)
            .executeTakeFirst();

        if (!run) {
            return null;
        }

        return {
            ...run,
            inputs: run.inputs ? run.inputs : undefined,
            outputs: run.outputs ? run.outputs : undefined,
            events: run.events ? run.events : undefined,
            error: run.error ? run.error : undefined,
            extra: run.extra ? run.extra : undefined,
            serialized: run.serialized ? run.serialized : undefined,
            tags: run.tags ? run.tags : undefined,
            feedback_count: run.feedback_count || 0,
            attachments_count: run.attachments_count || 0,
            feedback: [],
            attachments: [],
        };
    }

    // 获取多个 Runs
    async getRuns(
        limit: number = 100,
        offset: number = 0,
        filters?: {
            system?: string;
            model_name?: string;
            thread_id?: string;
            user_id?: string;
            run_type?: string;
            start_time_after?: Date;
            start_time_before?: Date;
        },
    ): Promise<RunRecord[]> {
        let query = this.db
            .selectFrom("runs")
            .selectAll()
            .orderBy("start_time", "desc")
            .limit(limit)
            .offset(offset);

        if (filters) {
            if (filters.system) {
                query = query.where("system", "=", filters.system);
            }
            if (filters.model_name) {
                query = query.where("model_name", "=", filters.model_name);
            }
            if (filters.thread_id) {
                query = query.where("thread_id", "=", filters.thread_id);
            }
            if (filters.user_id) {
                query = query.where("user_id", "=", filters.user_id);
            }
            if (filters.run_type) {
                query = query.where("run_type", "=", filters.run_type);
            }
            if (filters.start_time_after) {
                query = query.where(
                    "start_time",
                    ">=",
                    filters.start_time_after,
                );
            }
            if (filters.start_time_before) {
                query = query.where(
                    "start_time",
                    "<=",
                    filters.start_time_before,
                );
            }
        }

        const runs = await query.execute();

        return runs.map((run) => ({
            ...run,
            inputs: run.inputs ? JSON.parse(run.inputs) : undefined,
            outputs: run.outputs ? JSON.parse(run.outputs) : undefined,
            events: run.events ? JSON.parse(run.events) : undefined,
            error: run.error ? JSON.parse(run.error) : undefined,
            extra: run.extra ? JSON.parse(run.extra) : undefined,
            serialized: run.serialized ? JSON.parse(run.serialized) : undefined,
            tags: run.tags ? JSON.parse(run.tags) : undefined,
            feedback_count: run.feedback_count || 0,
            attachments_count: run.attachments_count || 0,
            feedback: [],
            attachments: [],
        }));
    }

    // 删除 Run
    async deleteRun(runId: string): Promise<boolean> {
        const result = await this.db
            .deleteFrom("runs")
            .where("id", "=", runId)
            .executeTakeFirst();

        return (result.numDeletedRows ?? 0n) > 0n;
    }
}
