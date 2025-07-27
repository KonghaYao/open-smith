import { Database } from "bun:sqlite";
import type { DatabaseAdapter, PreparedStatement } from "../database.js";
import path from "path";
import fs from "fs";

// SQLite 适配器实现
export class BunSQLiteAdapter implements DatabaseAdapter {
    private db: Database;

    constructor(dbPath: string = "./.langgraph_api/trace.db") {
        console.log(`📊 Using Bun native SQLite for high performance`);
        // 确保文件夹存在
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Database(dbPath);
        // SQLite 特有：开启 WAL 模式以提高性能
        this.db.exec("PRAGMA journal_mode = WAL;");
    }

    async exec(sql: string): Promise<void> {
        this.db.exec(sql);
    }

    async prepare(sql: string): Promise<PreparedStatement> {
        const stmt = this.db.prepare(sql);
        return {
            run: async (params?: any[]): Promise<{ changes: number }> => {
                const result = stmt.run(params);
                return { changes: result.changes };
            },
            get: async (params?: any): Promise<any> => stmt.get(params),
            all: async (params?: any): Promise<any[]> => stmt.all(params),
        };
    }

    async transaction<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
    ): Promise<(...args: T) => Promise<R>> {
        const transactionFn = this.db.transaction(async (...args: T) => {
            return await fn(...args);
        });
        return async (...args: T): Promise<R> => {
            return transactionFn(...args);
        };
    }

    async close(): Promise<void> {
        this.db.close();
    }

    getStringAggregateFunction(
        column: string,
        distinct: boolean,
        delimiter: string,
    ): string {
        return `GROUP_CONCAT(${column}, '${delimiter}')`;
    }

    getPlaceholder(index: number): string {
        return "?";
    }
}
