import { v4 as uuidv4 } from "uuid";
import type { DatabaseAdapter } from "../interfaces.js";
import type { SystemRecord } from "../../types.js";
import { generateApiKey } from "../utils.js";

export class SystemRepository {
    constructor(private adapter: DatabaseAdapter) {}

    // 创建系统
    async createSystem(
        name: string,
        description?: string,
        apiKey?: string
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

        const stmt = await this.adapter.prepare(`
            INSERT INTO systems (
                id, name, description, api_key, status, created_at, updated_at
            ) VALUES (${this.adapter.getPlaceholder(
                1
            )}, ${this.adapter.getPlaceholder(
            2
        )}, ${this.adapter.getPlaceholder(3)}, ${this.adapter.getPlaceholder(
            4
        )}, ${this.adapter.getPlaceholder(5)}, ${this.adapter.getPlaceholder(
            6
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

    // 根据API密钥获取系统
    async getSystemByApiKey(apiKey: string): Promise<SystemRecord | null> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems WHERE api_key = ${this.adapter.getPlaceholder(
                1
            )} AND status = 'active'`
        );
        const result = (await stmt.get([apiKey])) as SystemRecord;
        return result || null;
    }

    // 根据名称获取系统
    async getSystemByName(name: string): Promise<SystemRecord | null> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems WHERE name = ${this.adapter.getPlaceholder(
                1
            )}`
        );
        const result = (await stmt.get([name])) as SystemRecord;
        return result || null;
    }

    // 根据ID获取系统
    async getSystemById(id: string): Promise<SystemRecord | null> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems WHERE id = ${this.adapter.getPlaceholder(1)}`
        );
        const result = (await stmt.get([id])) as SystemRecord;
        return result || null;
    }

    // 获取所有系统记录
    async getAllSystemRecords(): Promise<SystemRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems ORDER BY created_at DESC`
        );
        return (await stmt.all()) as SystemRecord[];
    }

    // 获取活跃系统
    async getActiveSystems(): Promise<SystemRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM systems WHERE status = 'active' ORDER BY created_at DESC`
        );
        return (await stmt.all()) as SystemRecord[];
    }

    // 更新系统状态
    async updateSystemStatus(
        id: string,
        status: "active" | "inactive"
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

    // 更新系统
    async updateSystem(
        id: string,
        updates: {
            name?: string;
            description?: string;
            status?: "active" | "inactive";
        }
    ): Promise<SystemRecord | null> {
        const now = new Date().toISOString();
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            updateFields.push(
                `name = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            updateValues.push(updates.name);
        }
        if (updates.description !== undefined) {
            updateFields.push(
                `description = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            updateValues.push(updates.description);
        }
        if (updates.status !== undefined) {
            updateFields.push(
                `status = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            updateValues.push(updates.status);
        }

        if (updateFields.length === 0) {
            return this.getSystemById(id);
        }

        updateFields.push(
            `updated_at = ${this.adapter.getPlaceholder(paramIndex++)}`
        );
        updateValues.push(now);
        updateValues.push(id);

        const stmt = await this.adapter.prepare(`
            UPDATE systems SET ${updateFields.join(
                ", "
            )} WHERE id = ${this.adapter.getPlaceholder(paramIndex)}
        `);

        const result = await stmt.run(updateValues);

        if (result.changes === 0) {
            return null;
        }

        return this.getSystemById(id);
    }

    // 重新生成API密钥
    async regenerateApiKey(id: string): Promise<SystemRecord | null> {
        const newApiKey = generateApiKey();
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

    // 删除系统
    async deleteSystem(id: string): Promise<boolean> {
        const stmt = await this.adapter.prepare(
            `DELETE FROM systems WHERE id = ${this.adapter.getPlaceholder(1)}`
        );
        const result = await stmt.run([id]);
        return result.changes > 0;
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
                `自动创建的系统: ${systemName}`
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

    // 获取所有系统名称列表
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
                    `从现有数据迁移: ${systemName}`
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
