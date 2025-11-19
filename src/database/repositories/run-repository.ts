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
                start_time: record.start_time ?? null,
                end_time: record.end_time ?? null,
                inputs: record.inputs ?? null,
                outputs: record.outputs ?? null,
                events: record.events ?? null,
                error: record.error ?? null,
                extra: record.extra ?? null,
                serialized: record.serialized ?? null,
                total_tokens: record.total_tokens ?? 0,
                created_at: record.created_at,
                updated_at: record.updated_at,
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
        const now = new Date().toISOString();
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
            updateData.start_time = formatTimestamp(runData.start_time);
        }
        if (runData.end_time !== undefined) {
            updateData.end_time = formatTimestamp(runData.end_time);
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
                ? (runData as any).tags.join(",")
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
        const now = new Date().toISOString();
        const jsonValue = json ? JSON.stringify(value) : value;

        await this.db
            .updateTable("runs")
            .set({
                [field]: jsonValue,
                updated_at: now,
            } as any)
            .where("id", "=", runId)
            .execute();

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

        return this.getRun(runId);
    }

    // 获取 Run
    async getRun(runId: string): Promise<RunRecord | null> {
        const result = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("id", "=", runId)
            .executeTakeFirst();

        return result
            ? {
                  ...result,
                  trace_id: result.trace_id ?? undefined,
                  name: result.name || "",
                  run_type: result.run_type ?? undefined,
                  system: result.system ?? undefined,
                  thread_id: result.thread_id ?? undefined,
                  user_id: result.user_id ?? undefined,
                  start_time: result.start_time || "",
                  end_time: result.end_time || "",
                  inputs: result.inputs ?? undefined,
                  outputs: result.outputs ?? undefined,
                  events: result.events ?? undefined,
                  error: result.error ?? undefined,
                  extra: result.extra ?? undefined,
                  serialized: result.serialized ?? undefined,
                  model_name: result.model_name ?? undefined,
                  tags: result.tags ?? undefined,
                  feedback_count: 0,
                  attachments_count: 0,
                  feedback: [],
                  attachments: [],
              }
            : null;
    }

    // 根据 trace_id 获取 runs
    async getRunsByTraceId(traceId: string): Promise<RunRecord[]> {
        const results = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("trace_id", "=", traceId)
            .orderBy("created_at")
            .execute();

        return results.map((r) => this.mapToRunRecord(r));
    }

    // 根据系统获取 runs
    async getRunsBySystem(system: string): Promise<RunRecord[]> {
        const results = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("system", "=", system)
            .orderBy("created_at", "desc")
            .execute();

        return results.map((r) => this.mapToRunRecord(r));
    }

    // 根据线程ID获取 runs
    async getRunsByThreadId(threadId: string): Promise<RunRecord[]> {
        const results = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("thread_id", "=", threadId)
            .orderBy("created_at", "desc")
            .execute();

        return results.map((r) => this.mapToRunRecord(r));
    }

    // 根据用户ID获取 runs
    async getRunsByUserId(userId: string): Promise<RunRecord[]> {
        const results = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("user_id", "=", userId)
            .orderBy("created_at", "desc")
            .execute();

        return results.map((r) => this.mapToRunRecord(r));
    }

    // 获取指定 run_type 的 runs，支持分页
    async getRunsByRunType(
        runType: string,
        limit: number,
        offset: number,
    ): Promise<RunRecord[]> {
        const results = await this.db
            .selectFrom("runs")
            .selectAll()
            .where("run_type", "=", runType)
            .orderBy("created_at", "desc")
            .limit(limit)
            .offset(offset)
            .execute();

        return results.map((r) => this.mapToRunRecord(r));
    }

    // 获取指定 run_type 的总记录数
    async countRunsByRunType(runType: string): Promise<number> {
        const result = await this.db
            .selectFrom("runs")
            .select(({ fn }) => [fn.count<number>("id").as("count")])
            .where("run_type", "=", runType)
            .executeTakeFirst();

        return Number(result?.count ?? 0);
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
        if (conditions.tag) {
            query = query
                .where("tags", "is not", null)
                .where("tags", "like", `%"${conditions.tag}"%`);
        }
        if (conditions.start_time_after) {
            query = query.where(
                "start_time",
                ">=",
                new Date(conditions.start_time_after).getTime().toString(),
            );
        }
        if (conditions.start_time_before) {
            query = query.where(
                "start_time",
                "<=",
                new Date(conditions.start_time_before).getTime().toString(),
            );
        }

        const results = await query
            .orderBy("created_at", "desc")
            .limit(limit)
            .offset(offset)
            .execute();

        return results.map((r) => this.mapToRunRecord(r));
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
        let query = this.db
            .selectFrom("runs")
            .select(({ fn }) => [fn.count<number>("id").as("count")]);

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
        if (conditions.tag) {
            query = query
                .where("tags", "is not", null)
                .where("tags", "like", `%"${conditions.tag}"%`);
        }
        if (conditions.start_time_after) {
            query = query.where(
                "start_time",
                ">=",
                new Date(conditions.start_time_after).getTime().toString(),
            );
        }
        if (conditions.start_time_before) {
            query = query.where(
                "start_time",
                "<=",
                new Date(conditions.start_time_before).getTime().toString(),
            );
        }

        const result = await query.executeTakeFirst();
        return Number(result?.count ?? 0);
    }

    // 获取所有线程ID列表
    async getAllThreadIds(): Promise<string[]> {
        const results = await this.db
            .selectFrom("runs")
            .select("thread_id")
            .distinct()
            .where("thread_id", "is not", null)
            .where("thread_id", "!=", "")
            .orderBy("thread_id")
            .execute();

        return results.map((r) => r.thread_id!);
    }

    // 获取所有用户ID列表
    async getAllUserIds(): Promise<string[]> {
        const results = await this.db
            .selectFrom("runs")
            .select("user_id")
            .distinct()
            .where("user_id", "is not", null)
            .where("user_id", "!=", "")
            .orderBy("user_id")
            .execute();

        return results.map((r) => r.user_id!);
    }

    // 获取所有模型名称列表
    async getAllModelNames(): Promise<string[]> {
        const results = await this.db
            .selectFrom("runs")
            .select("model_name")
            .distinct()
            .where("model_name", "is not", null)
            .where("model_name", "!=", "")
            .orderBy("model_name")
            .execute();

        return results.map((r) => r.model_name!);
    }

    // 辅助方法：将数据库记录映射为 RunRecord
    private mapToRunRecord(r: any): RunRecord {
        return {
            ...r,
            trace_id: r.trace_id ?? undefined,
            name: r.name ?? undefined,
            run_type: r.run_type ?? undefined,
            system: r.system ?? undefined,
            thread_id: r.thread_id ?? undefined,
            user_id: r.user_id ?? undefined,
            start_time: r.start_time ?? undefined,
            end_time: r.end_time ?? undefined,
            inputs: r.inputs ?? undefined,
            outputs: r.outputs ?? undefined,
            events: r.events ?? undefined,
            error: r.error ?? undefined,
            extra: r.extra ?? undefined,
            serialized: r.serialized ?? undefined,
            model_name: r.model_name ?? undefined,
            tags: r.tags ?? undefined,
            feedback_count: 0,
            attachments_count: 0,
            feedback: [],
            attachments: [],
        };
    }
}
