// Kysely Dialect 适配器 - 仅支持 PostgreSQL/TimescaleDB
import { Kysely, PostgresDialect } from "kysely";
import type { Database } from "./schema.js";
import { Pool, type PoolConfig } from "pg";

// 数据库类型标识
export const dbType = "pg" as const;

/**
 * 创建 PostgreSQL/TimescaleDB Kysely 实例
 */
export async function createPostgresKysely(
    config: PoolConfig,
): Promise<Kysely<Database>> {
    console.log(`📊 Using PostgreSQL/TimescaleDB with Kysely for high performance`);
    const { Pool } = await import("pg");
    const pool = new Pool(config);

    const dialect = new PostgresDialect({
        pool,
    });

    return new Kysely<Database>({ dialect });
}

/**
 * 创建 Kysely 实例 - 仅支持 PostgreSQL/TimescaleDB
 */
export async function createKyselyInstance(config: {
    connectionString: string;
}): Promise<Kysely<Database>> {
    if (!config?.connectionString) {
        throw new Error("TRACE_DATABASE_URL environment variable is required");
    }

    if (!config.connectionString.startsWith("postgres")) {
        throw new Error("Only PostgreSQL/TimescaleDB is supported. Please provide a valid PostgreSQL connection string.");
    }

    return createPostgresKysely({
        connectionString: config.connectionString,
    });
}
