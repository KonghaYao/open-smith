import { TraceDatabase } from "./database.js";

// API Key 缓存类
export class ApiKeyCache {
    private cache = new Map<
        string,
        { systemName: string; timestamp: number }
    >();
    private readonly TTL = 5 * 60 * 1000; // 5分钟TTL
    private db: TraceDatabase;

    constructor(database: TraceDatabase) {
        this.db = database;
        // 每分钟清理过期缓存
        setInterval(() => this.cleanup(), 60 * 1000);
    }

    async getSystemNameByApiKey(apiKey: string): Promise<string | null> {
        if (!apiKey) return null;

        // 检查缓存
        const cached = this.cache.get(apiKey);
        if (cached && Date.now() - cached.timestamp < this.TTL) {
            return cached.systemName;
        }

        // 从数据库查询
        try {
            const system = await this.db.getSystemByApiKey(apiKey);
            if (system) {
                // 更新缓存
                this.cache.set(apiKey, {
                    systemName: system.name,
                    timestamp: Date.now(),
                });
                return system.name;
            }
        } catch (error) {
            console.error("查询系统信息失败:", error);
        }

        return null;
    }

    // 清理过期缓存
    private cleanup(): void {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp >= this.TTL) {
                this.cache.delete(key);
            }
        }
    }

    // 手动清理缓存（当系统信息更新时调用）
    invalidate(apiKey?: string): void {
        if (apiKey) {
            this.cache.delete(apiKey);
        } else {
            this.cache.clear();
        }
    }

    // 获取缓存统计信息
    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
}
