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
        const now = new Date();

        const record: SystemRecord = {
            id,
            name,
            description,
            api_key: finalApiKey,
            status: "active",
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        };

        await this.db
            .insertInto("systems")
            .values({
                id: record.id,
                name: record.name,
                description: record.description ?? null,
                api_key: record.api_key,
                status: record.status,
                created_at: now,
                updated_at: now,
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
            ? this.mapDbToSystemRecord(result)
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
            ? this.mapDbToSystemRecord(result)
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
            ? this.mapDbToSystemRecord(result)
            : null;
    }

    // 获取所有系统记录
    async getAllSystemRecords(): Promise<SystemRecord[]> {
        const results = await this.db
            .selectFrom("systems")
            .selectAll()
            .orderBy("created_at", "desc")
            .execute();

        return results.map((r) => this.mapDbToSystemRecord(r));
    }

    // 获取所有激活的系统
    async getActiveSystems(): Promise<SystemRecord[]> {
        const results = await this.db
            .selectFrom("systems")
            .selectAll()
            .where("status", "=", "active")
            .orderBy("created_at", "desc")
            .execute();

        return results.map((r) => this.mapDbToSystemRecord(r));
    }

    // 更新系统状态
    async updateSystemStatus(
        id: string,
        status: "active" | "inactive",
    ): Promise<SystemRecord | null> {
        const now = new Date();

        const result = await this.db
            .updateTable("systems")
            .set({
                status,
                updated_at: now,
            })
            .where("id", "=", id)
            .executeTakeFirst();

        if ((result.numUpdatedRows ?? 0n) === 0n) {
            return null;
        }

        return this.getSystemById(id);
    }

    // 更新系统信息
    async updateSystem(
        id: string,
        updates: {
            name?: string;
            description?: string;
            status?: "active" | "inactive";
        },
    ): Promise<SystemRecord | null> {
        const now = new Date();
        const updateData: any = { updated_at: now };

        if (updates.name !== undefined) {
            updateData.name = updates.name;
        }
        if (updates.description !== undefined) {
            updateData.description = updates.description;
        }
        if (updates.status !== undefined) {
            updateData.status = updates.status;
        }

        const result = await this.db
            .updateTable("systems")
            .set(updateData)
            .where("id", "=", id)
            .executeTakeFirst();

        if ((result.numUpdatedRows ?? 0n) === 0n) {
            return null;
        }

        return this.getSystemById(id);
    }

    // 重新生成 API Key
    async regenerateApiKey(id: string): Promise<SystemRecord | null> {
        const newApiKey = generateApiKey();
        const now = new Date();

        const result = await this.db
            .updateTable("systems")
            .set({
                api_key: newApiKey,
                updated_at: now,
            })
            .where("id", "=", id)
            .executeTakeFirst();

        if ((result.numUpdatedRows ?? 0n) === 0n) {
            return null;
        }

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

    // 确保系统存在
    async ensureSystemExists(systemName: string): Promise<SystemRecord> {
        let system = await this.getSystemByName(systemName);

        if (!system) {
            system = await this.createSystem(systemName, `Auto-created system: ${systemName}`);
        }

        return system;
    }

    // 获取系统统计信息
    async getSystemStats(systemName: string): Promise<{
        total_runs: number;
        total_traces: number;
        total_tokens: number;
        total_feedback: number;
        total_attachments: number;
        first_run_time?: string;
        last_run_time?: string;
    }> {
        const runsStats = await this.db
            .selectFrom("runs")
            .select((eb) => [
                eb.fn.count("id").as("total_runs"),
                eb.fn.count("trace_id").filterWhere("trace_id", "is not", null).distinct().as("total_traces"),
                eb.fn.coalesce(eb.fn.sum("total_tokens"), sql<number>`0`).as("total_tokens"),
                eb.fn.min("start_time").as("first_run_time"),
                eb.fn.max("start_time").as("last_run_time"),
            ])
            .where("system", "=", systemName)
            .executeTakeFirst();

        const feedbackCount = await this.db
            .selectFrom("feedback")
            .select((eb) => eb.fn.count("id").as("count"))
            .innerJoin("runs", "feedback.run_id", "runs.id")
            .where("runs.system", "=", systemName)
            .executeTakeFirst();

        const attachmentCount = await this.db
            .selectFrom("attachments")
            .select((eb) => eb.fn.count("id").as("count"))
            .innerJoin("runs", "attachments.run_id", "runs.id")
            .where("runs.system", "=", systemName)
            .executeTakeFirst();

        return {
            total_runs: Number(runsStats?.total_runs ?? 0),
            total_traces: Number(runsStats?.total_traces ?? 0),
            total_tokens: Number(runsStats?.total_tokens ?? 0),
            total_feedback: Number(feedbackCount?.count ?? 0),
            total_attachments: Number(attachmentCount?.count ?? 0),
            first_run_time: runsStats?.first_run_time
                ? new Date(runsStats.first_run_time).toISOString()
                : undefined,
            last_run_time: runsStats?.last_run_time
                ? new Date(runsStats.last_run_time).toISOString()
                : undefined,
        };
    }

    // 获取所有系统名称
    async getAllSystems(): Promise<string[]> {
        const results = await this.db
            .selectFrom("systems")
            .select("name")
            .execute();

        return results.map((r) => r.name);
    }

    // 迁移现有的 runs 到系统
    async migrateExistingRunsToSystems(): Promise<{
        created: number;
        skipped: number;
    }> {
        // 获取所有唯一的 system 名称
        const uniqueSystems = await this.db
            .selectFrom("runs")
            .select("system")
            .where("system", "is not", null)
            .distinct()
            .execute();

        let created = 0;
        let skipped = 0;

        for (const { system } of uniqueSystems) {
            if (!system) continue;

            const existing = await this.getSystemByName(system);
            if (!existing) {
                await this.createSystem(system, `Migrated from existing runs`);
                created++;
            } else {
                skipped++;
            }
        }

        return { created, skipped };
    }

    // 验证系统引用完整性
    async validateSystemReferences(): Promise<string[]> {
        // 查找 runs 表中引用的不存在的系统
        const orphanedSystems = await this.db
            .selectFrom("runs")
            .select("system")
            .where((eb) =>
                eb("system", "is not", null).and(
                    eb(
                        "system",
                        "not in",
                        eb
                            .selectFrom("systems")
                            .select("name"),
                    ),
                ),
            )
            .distinct()
            .execute();

        return orphanedSystems.map((r) => r.system!).filter(Boolean);
    }

    // 映射数据库记录到 SystemRecord
    private mapDbToSystemRecord(dbRecord: any): SystemRecord {
        return {
            id: dbRecord.id,
            name: dbRecord.name,
            description: dbRecord.description ?? undefined,
            api_key: dbRecord.api_key,
            status: dbRecord.status,
            created_at: dbRecord.created_at
                ? new Date(dbRecord.created_at).toISOString()
                : "",
            updated_at: dbRecord.updated_at
                ? new Date(dbRecord.updated_at).toISOString()
                : "",
        };
    }
}
