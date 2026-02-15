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
            updateData.start_time = new Date(formatTimestamp(runData.start_time)!);
        }
        if (runData.end_time !== undefined) {
            updateData.end_time = new Date(formatTimestamp(runData.end_time)!);
        }
        if (runData.inputs !== undefined) {
            updateData.inputs = JSON.stringify(runData.inputs);
        }
        if (runData.outputs !== undefined) {
            updateData.outputs = JSON.stringify(runData.outputs);
            updateData.total_tokens = extractTotalTokensFromOutputs(
                runData.outputs,
            );
            updateData.model_name = extractModelNameFromOutputs(
                runData.outputs,
            );
        } else if (runData.total_tokens !== undefined) {
            updateData.total_tokens = runData.total_tokens;
        }

        if (runData.model_name !== undefined && runData.outputs === undefined) {
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

        return this.mapDbToRunRecord(run);
    }

    // 根据 trace_id 获取所有 Runs
    async getRunsByTraceId(traceId: string): Promise<RunRecord[]> {
        const runs = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("trace_id", "=", traceId)
            .orderBy("start_time", "asc")
            .execute();

        return runs.map((run) => this.mapDbToRunRecord(run));
    }

    // 根据 system 获取所有 Runs
    async getRunsBySystem(system: string): Promise<RunRecord[]> {
        const runs = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("system", "=", system)
            .orderBy("start_time", "desc")
            .execute();

        return runs.map((run) => this.mapDbToRunRecord(run));
    }

    // 根据 thread_id 获取所有 Runs
    async getRunsByThreadId(threadId: string): Promise<RunRecord[]> {
        const runs = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("thread_id", "=", threadId)
            .orderBy("start_time", "asc")
            .execute();

        return runs.map((run) => this.mapDbToRunRecord(run));
    }

    // 根据 user_id 获取所有 Runs
    async getRunsByUserId(userId: string): Promise<RunRecord[]> {
        const runs = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("user_id", "=", userId)
            .orderBy("start_time", "desc")
            .execute();

        return runs.map((run) => this.mapDbToRunRecord(run));
    }

    // 根据 run_type 获取 Runs (分页)
    async getRunsByRunType(
        runType: string,
        limit: number,
        offset: number,
    ): Promise<RunRecord[]> {
        const runs = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("run_type", "=", runType)
            .orderBy("start_time", "desc")
            .limit(limit)
            .offset(offset)
            .execute();

        return runs.map((run) => this.mapDbToRunRecord(run));
    }

    // 统计指定 run_type 的 Runs 数量
    async countRunsByRunType(runType: string): Promise<number> {
        const result = await this.db
            .selectFrom("runs")
            .select((eb) => [eb.fn.count("id").as("count")])
            .where("run_type", "=", runType)
            .executeTakeFirst();

        return Number(result?.count ?? 0);
    }

    // 根据条件查询 Runs
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
        let query = this.db.selectFrom("runs").selectAll();

        if (conditions.run_type) {
            query = query.where("run_type", "=", conditions.run_type);
        }
        if (conditions.system) {
            query = query.where("system", "=", conditions.system);
        }
        if (conditions.model_name) {
            query = query.where("model_name", "=", conditions.model_name);
        }
        if (conditions.thread_id) {
            query = query.where("thread_id", "=", conditions.thread_id);
        }
        if (conditions.user_id) {
            query = query.where("user_id", "=", conditions.user_id);
        }
        if (conditions.start_time_after) {
            query = query.where(
                "start_time",
                ">=",
                new Date(conditions.start_time_after),
            );
        }
        if (conditions.start_time_before) {
            query = query.where(
                "start_time",
                "<=",
                new Date(conditions.start_time_before),
            );
        }

        const runs = await query
            .orderBy("start_time", "desc")
            .limit(limit)
            .offset(offset)
            .execute();

        return runs.map((run) => this.mapDbToRunRecord(run));
    }

    // 统计符合条件的 Runs 数量
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
        let query = this.db
            .selectFrom("runs")
            .select((eb) => [eb.fn.count("id").as("count")]);

        if (conditions.run_type) {
            query = query.where("run_type", "=", conditions.run_type);
        }
        if (conditions.system) {
            query = query.where("system", "=", conditions.system);
        }
        if (conditions.model_name) {
            query = query.where("model_name", "=", conditions.model_name);
        }
        if (conditions.thread_id) {
            query = query.where("thread_id", "=", conditions.thread_id);
        }
        if (conditions.user_id) {
            query = query.where("user_id", "=", conditions.user_id);
        }
        if (conditions.start_time_after) {
            query = query.where(
                "start_time",
                ">=",
                new Date(conditions.start_time_after),
            );
        }
        if (conditions.start_time_before) {
            query = query.where(
                "start_time",
                "<=",
                new Date(conditions.start_time_before),
            );
        }

        const result = await query.executeTakeFirst();
        return Number(result?.count ?? 0);
    }

    // 获取所有 thread_id
    async getAllThreadIds(): Promise<string[]> {
        const results = await this.db
            .selectFrom("runs")
            .select("thread_id")
            .where("thread_id", "is not", null)
            .distinct()
            .execute();

        return results.map((r) => r.thread_id!).filter(Boolean);
    }

    // 获取所有 user_id
    async getAllUserIds(): Promise<string[]> {
        const results = await this.db
            .selectFrom("runs")
            .select("user_id")
            .where("user_id", "is not", null)
            .distinct()
            .execute();

        return results.map((r) => r.user_id!).filter(Boolean);
    }

    // 获取所有 model_name
    async getAllModelNames(): Promise<string[]> {
        const results = await this.db
            .selectFrom("runs")
            .select("model_name")
            .where("model_name", "is not", null)
            .distinct()
            .execute();

        return results.map((r) => r.model_name!).filter(Boolean);
    }

    // 映射数据库记录到 RunRecord
    private mapDbToRunRecord(dbRecord: any): RunRecord {
        return {
            id: dbRecord.id,
            trace_id: dbRecord.trace_id ?? undefined,
            name: dbRecord.name ?? "",
            run_type: dbRecord.run_type ?? undefined,
            system: dbRecord.system ?? undefined,
            thread_id: dbRecord.thread_id ?? undefined,
            user_id: dbRecord.user_id ?? undefined,
            start_time: dbRecord.start_time
                ? new Date(dbRecord.start_time).toISOString()
                : "",
            end_time: dbRecord.end_time
                ? new Date(dbRecord.end_time).toISOString()
                : "",
            inputs: dbRecord.inputs ?? undefined,
            outputs: dbRecord.outputs ?? undefined,
            events: dbRecord.events ?? undefined,
            error: dbRecord.error ?? undefined,
            extra: dbRecord.extra ?? undefined,
            serialized: dbRecord.serialized ?? undefined,
            total_tokens: dbRecord.total_tokens ?? 0,
            model_name: dbRecord.model_name ?? undefined,
            time_to_first_token: dbRecord.time_to_first_token ?? 0,
            tags: dbRecord.tags ?? undefined,
            created_at: dbRecord.created_at
                ? new Date(dbRecord.created_at).toISOString()
                : "",
            updated_at: dbRecord.updated_at
                ? new Date(dbRecord.updated_at).toISOString()
                : "",
            feedback_count: 0,
            attachments_count: 0,
            feedback: [],
            attachments: [],
        };
    }
}
