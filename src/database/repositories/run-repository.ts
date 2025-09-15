import { v4 as uuidv4 } from "uuid";
import type { DatabaseAdapter } from "../interfaces.js";
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
    constructor(private adapter: DatabaseAdapter) {}

    // 创建 Run
    async createRun(runData: RunPayload): Promise<RunRecord> {
        const id = runData.id || uuidv4();
        const now = new Date().toISOString();

        // 从 extra 中提取 thread_id（如果未直接提供）
        const threadId =
            runData.thread_id || extractThreadIdFromExtra(runData.extra);

        // 从 extra 中提取 user_id
        const userId = extractUserIdFromExtra(runData.extra);

        const record: RunRecord = {
            id,
            trace_id: runData.trace_id,
            name: runData.name!,
            run_type: runData.run_type,
            system: runData.system,
            thread_id: threadId,
            user_id: userId,
            start_time: formatTimestamp(runData.start_time)!,
            end_time: formatTimestamp(runData.end_time)!,
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
                ? extractTotalTokensFromOutputs(runData.outputs)
                : 0,
            model_name: runData.outputs
                ? extractModelNameFromOutputs(runData.outputs)
                : undefined,
            time_to_first_token: runData.events
                ? extractTimeToFirstTokenFromEvents(runData.events)
                : 0,
            tags: (runData as any).tags
                ? (runData as any).tags.join(",")
                : undefined,
            feedback_count: 0,
            attachments_count: 0,
            feedback: [],
            attachments: [],
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

    // 更新 Run
    async updateRun(
        runId: string,
        runData: RunPayload,
    ): Promise<RunRecord | null> {
        const now = new Date().toISOString();
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

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
            updateValues.push(extractTotalTokensFromOutputs(runData.outputs));

            // 如果 outputs 被更新，重新计算并更新 model_name
            updateFields.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            updateValues.push(extractModelNameFromOutputs(runData.outputs));
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
                extractTimeToFirstTokenFromEvents(runData.events),
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
                const threadId = extractThreadIdFromExtra(runData.extra);
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
            const userId = extractUserIdFromExtra(runData.extra);
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
        updateValues.push(runId);

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

    // 更新单个字段
    async updateRunField(
        runId: string,
        field: string,
        value: any,
        json = true,
    ): Promise<RunRecord | null> {
        const now = new Date().toISOString();
        const jsonValue = json ? JSON.stringify(value) : value;

        const stmt = await this.adapter.prepare(`
            UPDATE runs SET ${field} = ${this.adapter.getPlaceholder(
            1,
        )}, updated_at = ${this.adapter.getPlaceholder(
            2,
        )} WHERE id = ${this.adapter.getPlaceholder(3)}
        `);

        const result = await stmt.run([jsonValue, now, runId]);

        if (field === "outputs") {
            const total_tokens = extractTotalTokensFromOutputs(value);
            await this.updateRunField(
                runId,
                "total_tokens",
                total_tokens,
                false,
            );
            const model_name = extractModelNameFromOutputs(value);
            await this.updateRunField(runId, "model_name", model_name, false);
        }
        if (field === "events") {
            const time_to_first_token =
                extractTimeToFirstTokenFromEvents(value);
            await this.updateRunField(
                runId,
                "time_to_first_token",
                time_to_first_token,
                false,
            );
        }
        if (field === "extra") {
            const thread_id = extractThreadIdFromExtra(value);
            if (thread_id)
                await this.updateRunField(runId, "thread_id", thread_id, false);
            const user_id = extractUserIdFromExtra(value);
            if (user_id)
                await this.updateRunField(runId, "user_id", user_id, false);
        }
        if (result.changes === 0) {
            return null;
        }

        return this.getRun(runId);
    }

    // 获取 Run
    async getRun(runId: string): Promise<RunRecord | null> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM runs WHERE id = ${this.adapter.getPlaceholder(1)}`,
        );
        const result = (await stmt.get([runId])) as RunRecord;
        return result || null;
    }

    // 根据 trace_id 获取 runs
    async getRunsByTraceId(traceId: string): Promise<RunRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM runs WHERE trace_id = ${this.adapter.getPlaceholder(
                1,
            )} ORDER BY created_at`,
        );
        return (await stmt.all([traceId])) as RunRecord[];
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
            start_time_after?: string;
            start_time_before?: string;
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
        if (conditions.start_time_after) {
            whereConditions.push(
                `start_time >= ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(new Date(conditions.start_time_after).getTime());
        }
        if (conditions.start_time_before) {
            whereConditions.push(
                `start_time <= ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(new Date(conditions.start_time_before).getTime());
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
        start_time_after?: string;
        start_time_before?: string;
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
        if (conditions.start_time_after) {
            whereConditions.push(
                `start_time >= ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(new Date(conditions.start_time_after).getTime());
        }
        if (conditions.start_time_before) {
            whereConditions.push(
                `start_time <= ${this.adapter.getPlaceholder(paramIndex++)}`,
            );
            values.push(new Date(conditions.start_time_before).getTime());
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
}
