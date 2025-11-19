// Kysely Dialect 适配器
import { Kysely, SqliteDialect, PostgresDialect } from "kysely";
import type { Database } from "./schema.js";
import { Pool, type PoolConfig } from "pg";
import path from "path";
import fs from "fs";
export let dbType: "pg" | "sqlite" = "sqlite";
async function createSqliteKysely(
    connectionString: string,
): Promise<Kysely<Database>> {
    const dbPath = connectionString.startsWith("sqlite://")
        ? new URL(connectionString).pathname
        : connectionString;

    // 确保文件夹存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    /** @ts-ignore */
    if (globalThis.Bun) {
        console.log(`📊 Using Bun SQLite with Kysely for high performance`);
        const { BunWorkerDialect } = await import("kysely-bun-worker");
        return new Kysely<Database>({
            dialect: new BunWorkerDialect({ url: dbPath }),
        });
    } else {
        console.log(
            `📊 Using Better-SQLite3 with Kysely for high performance (Node.js)`,
        );
        const { default: BetterSqlite3 } = await import("better-sqlite3");
        const db = new BetterSqlite3(dbPath); // SQLite 特有：开启 WAL 模式以提高性能
        db.pragma("journal_mode = WAL");
        return new Kysely<Database>({
            dialect: new SqliteDialect({ database: db }),
        });
    }
}

/**
 * 创建 PostgreSQL Kysely 实例
 */
export async function createPostgresKysely(
    config: PoolConfig,
): Promise<Kysely<Database>> {
    console.log(`📊 Using PostgreSQL with Kysely for high performance`);
    const { Pool } = await import("pg");
    dbType = "pg";
    const pool = new Pool(config);

    const dialect = new PostgresDialect({
        pool,
    });

    return new Kysely<Database>({ dialect });
}

/**
 * 自动检测运行环境并创建对应的 Kysely 实例
 */
export async function createKyselyInstance(config: {
    connectionString: string;
}): Promise<Kysely<Database>> {
    if (config?.connectionString.startsWith("postgres")) {
        return createPostgresKysely({
            connectionString: config.connectionString,
        });
    }
    return createSqliteKysely(config?.connectionString);
}
