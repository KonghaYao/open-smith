import { v4 as uuidv4 } from "uuid";
import { sql, type Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { SystemRecord } from "../../types.js";
import { generateApiKey } from "../utils.js";

export class SystemRepository {
    constructor(private db: Kysely<Database>) {}

    // 创建系统
    async createSystem(
        name: string,
        description?: string,
        apiKey?: string,
    ): Promise<SystemRecord> {
        const id = uuidv4();
        const finalApiKey = apiKey || generateApiKey();
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

        await this.db
            .insertInto("systems")
            .values({
                id: record.id,
                name: record.name,
                description: record.description ?? null,
                api_key: record.api_key,
                status: record.status,
                created_at: record.created_at,
                updated_at: record.updated_at,
            })
            .execute();

        return record;
    }

    // 根据API密钥获取系统
    async getSystemByApiKey(apiKey: string): Promise<SystemRecord | null> {
        const result = await this.db
            .selectFrom("systems")
            .selectAll()
            .where("api_key", "=", apiKey)
            .where("status", "=", "active")
            .executeTakeFirst();

        return result
            ? {
                  ...result,
                  description: result.description ?? undefined,
              }
            : null;
    }

    // 根据名称获取系统
    async getSystemByName(name: string): Promise<SystemRecord | null> {
        const result = await this.db
            .selectFrom("systems")
            .selectAll()
            .where("name", "=", name)
            .executeTakeFirst();

        return result
            ? {
                  ...result,
                  description: result.description ?? undefined,
              }
            : null;
    }

    // 根据ID获取系统
    async getSystemById(id: string): Promise<SystemRecord | null> {
        const result = await this.db
            .selectFrom("systems")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirst();

        return result
            ? {
                  ...result,
                  description: result.description ?? undefined,
              }
            : null;
    }

    // 获取所有系统记录
    async getAllSystemRecords(): Promise<SystemRecord[]> {
        const results = await this.db
            .selectFrom("systems")
            .selectAll()
            .orderBy("created_at", "desc")
            .execute();

        return results.map((r) => ({
            ...r,
            description: r.description ?? undefined,
        }));
    }

    // 获取活跃系统
    async getActiveSystems(): Promise<SystemRecord[]> {
        const results = await this.db
            .selectFrom("systems")
            .selectAll()
            .where("status", "=", "active")
            .orderBy("created_at", "desc")
            .execute();

        return results.map((r) => ({
            ...r,
            description: r.description ?? undefined,
        }));
    }

    // 更新系统状态
    async updateSystemStatus(
        id: string,
        status: "active" | "inactive",
    ): Promise<SystemRecord | null> {
        const now = new Date().toISOString();

        await this.db
            .updateTable("systems")
            .set({
                status,
                updated_at: now,
            })
            .where("id", "=", id)
            .execute();

        return this.getSystemById(id);
    }

    // 更新系统
    async updateSystem(
        id: string,
        updates: {
            name?: string;
            description?: string;
            status?: "active" | "inactive";
        },
    ): Promise<SystemRecord | null> {
        const now = new Date().toISOString();

        const updateData: Record<string, any> = {
            updated_at: now,
        };

        if (updates.name !== undefined) {
            updateData.name = updates.name;
        }
        if (updates.description !== undefined) {
            updateData.description = updates.description;
        }
        if (updates.status !== undefined) {
            updateData.status = updates.status;
        }

        if (Object.keys(updateData).length === 1) {
            // 只有 updated_at，无需更新
            return this.getSystemById(id);
        }

        await this.db
            .updateTable("systems")
            .set(updateData)
            .where("id", "=", id)
            .execute();

        return this.getSystemById(id);
    }

    // 重新生成API密钥
    async regenerateApiKey(id: string): Promise<SystemRecord | null> {
        const newApiKey = generateApiKey();
        const now = new Date().toISOString();

        await this.db
            .updateTable("systems")
            .set({
                api_key: newApiKey,
                updated_at: now,
            })
            .where("id", "=", id)
            .execute();

        return this.getSystemById(id);
    }

    // 删除系统
    async deleteSystem(id: string): Promise<boolean> {
        const result = await this.db
            .deleteFrom("systems")
            .where("id", "=", id)
            .executeTakeFirst();

        return (result.numDeletedRows ?? 0n) > 0n;
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
        const runStats = await this.db
            .selectFrom("runs")
            .select(({ fn }) => [
                fn.count<number>("id").as("total_runs"),
                sql<number>`COUNT(DISTINCT trace_id)`.as("total_traces"),
                fn
                    .coalesce(fn.sum<number>("total_tokens"), sql<number>`0`)
                    .as("total_tokens"),
                fn.min("created_at").as("first_run_time"),
                fn.max("created_at").as("last_run_time"),
            ])
            .where("system", "=", systemName)
            .executeTakeFirst();

        const feedbackStats = await this.db
            .selectFrom("feedback")
            .innerJoin("runs", "feedback.run_id", "runs.id")
            .select(({ fn }) => [fn.count<number>("feedback.id").as("count")])
            .where("runs.system", "=", systemName)
            .executeTakeFirst();

        const attachmentStats = await this.db
            .selectFrom("attachments")
            .innerJoin("runs", "attachments.run_id", "runs.id")
            .select(({ fn }) => [
                fn.count<number>("attachments.id").as("count"),
            ])
            .where("runs.system", "=", systemName)
            .executeTakeFirst();

        return {
            total_runs: Number(runStats?.total_runs ?? 0),
            total_traces: Number(runStats?.total_traces ?? 0),
            total_tokens: Number(runStats?.total_tokens ?? 0),
            total_feedback: Number(feedbackStats?.count ?? 0),
            total_attachments: Number(attachmentStats?.count ?? 0),
            first_run_time: runStats?.first_run_time ?? undefined,
            last_run_time: runStats?.last_run_time ?? undefined,
        };
    }

    // 获取所有系统名称列表
    async getAllSystems(): Promise<string[]> {
        const results = await this.db
            .selectFrom("runs")
            .select("system")
            .distinct()
            .where("system", "is not", null)
            .where("system", "!=", "")
            .orderBy("system")
            .execute();

        return results.map((r) => r.system!);
    }

    // 数据迁移：为现有的runs记录创建对应的系统记录
    async migrateExistingRunsToSystems(): Promise<{
        created: number;
        skipped: number;
    }> {
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
        const result = await this.db
            .selectFrom("runs")
            .leftJoin("systems", "runs.system", "systems.name")
            .select("runs.system")
            .distinct()
            .where("runs.system", "is not", null)
            .where("runs.system", "!=", "")
            .where("systems.name", "is", null)
            .execute();

        return result.map((r) => r.system!);
    }
}
