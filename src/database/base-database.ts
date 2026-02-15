import type { Kysely } from "kysely";
import type { Database } from "./schema.js";
import { sql } from "kysely";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BaseDatabase {
    protected db: Kysely<Database>;

    constructor(db: Kysely<Database>) {
        this.db = db;
    }

    // 初始化方法，需要在使用数据库前调用
    async init(): Promise<void> {
        await this.initTables();
    }

    // 初始化数据库表结构
    private async initTables(): Promise<void> {
        // 读取 TimescaleDB 初始化脚本
        const scriptPath = path.join(__dirname, "../../sql/init-timescaledb.sql");
        const sqlScript = fs.readFileSync(scriptPath, "utf-8");

        // 分割 SQL 语句并执行
        const statements = this.splitSqlStatements(sqlScript);

        for (const statement of statements) {
            if (statement.trim() && !statement.trim().startsWith("--")) {
                try {
                    await sql.raw(statement).execute(this.db);
                } catch (error: any) {
                    // 忽略已存在的错误
                    const isIgnorableError =
                        error.message?.includes("already exists") ||
                        error.message?.includes("IF NOT EXISTS") ||
                        error.code === "42P07" || // duplicate_table
                        error.code === "42710"; // duplicate_object

                    if (isIgnorableError) {
                        // 忽略这些错误
                        continue;
                    }

                    // 对于连续聚合视图的特殊处理
                    if (statement.includes("CREATE MATERIALIZED VIEW") &&
                        error.code === "25001") { // cannot run inside a transaction block
                        // 这种错误通常在视图已存在时发生，可以忽略
                        console.log("Note: Continuous aggregate view may already exist");
                        continue;
                    }

                    // 对于 DO 块的特殊处理（可能包含多次 DROP）
                    if (statement.startsWith("DO $$")) {
                        // 如果 DO 块失败，可能是因为某些表不存在或已经是 hypertable
                        // 我们可以忽略这类错误，因为后面会有 IF NOT EXISTS 检查
                        console.log(`Note: Cleanup DO block encountered an error (ignoring):`, error.message);
                        continue;
                    }

                    // 如果错误码是 42P01 (relation does not exist)，可能是表不存在，可以忽略
                    if (error.code === "42P01") {
                        console.log(`Note: Relation does not exist (ignoring):`, error.message);
                        continue;
                    }

                    // 如果错误包含 "time_column_name"，可能是 TimescaleDB 版本兼容问题
                    if (error.message?.includes("time_column_name")) {
                        console.log(`Note: TimescaleDB version compatibility issue (ignoring):`, error.message);
                        continue;
                    }

                    console.error("Error executing SQL statement:", error.message);
                    console.error("Statement:", statement.substring(0, 200) + "...");
                    throw error;
                }
            }
        }

        // 验证关键表是否已创建
        await this.verifyTables();

        console.log("✓ TimescaleDB tables initialized successfully");
    }

    // 验证关键表是否存在
    private async verifyTables(): Promise<void> {
        const requiredTables = ['systems', 'runs', 'feedback', 'attachments', 'run_stats_raw'];

        for (const tableName of requiredTables) {
            try {
                const result = await sql`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = ${sql.raw(`'${tableName}'`)}
                    )
                `.execute(this.db);

                const exists = result.rows[0]?.exists;
                if (!exists) {
                    throw new Error(`Required table '${tableName}' does not exist after initialization`);
                }
            } catch (error) {
                console.error(`Error verifying table '${tableName}':`, error);
                throw error;
            }
        }
    }

    // 分割 SQL 语句
    private splitSqlStatements(sqlScript: string): string[] {
        const statements: string[] = [];
        let currentStatement = "";
        let inString = false;
        let inComment = false;
        let inDollarQuote = false;
        let stringChar = "";
        let dollarQuoteTag = "";

        let i = 0;
        while (i < sqlScript.length) {
            const char = sqlScript[i];

            // 处理 $$ 分隔符（PL/pgSQL 块）
            if (!inString && !inComment && char === '$' && i + 1 < sqlScript.length && sqlScript[i + 1] === '$') {
                if (!inDollarQuote) {
                    // 开始 $$ 分隔符
                    // 检查是否有标签（如 $$tag$$）
                    let tagEnd = i + 2;
                    while (tagEnd < sqlScript.length && sqlScript[tagEnd] !== '$') {
                        tagEnd++;
                    }
                    if (tagEnd + 1 < sqlScript.length && sqlScript[tagEnd] === '$' && sqlScript[tagEnd + 1] === '$') {
                        dollarQuoteTag = sqlScript.slice(i + 2, tagEnd);
                        inDollarQuote = true;
                        currentStatement += sqlScript.slice(i, tagEnd + 2);
                        i = tagEnd + 2;
                        continue;
                    } else {
                        // 只是 $$ 分隔符
                        inDollarQuote = true;
                        currentStatement += "$$";
                        i += 2;
                        continue;
                    }
                } else {
                    // 结束 $$ 分隔符
                    if (dollarQuoteTag) {
                        const closingTag = "$$" + dollarQuoteTag + "$$";
                        if (sqlScript.slice(i, i + closingTag.length) === closingTag) {
                            inDollarQuote = false;
                            currentStatement += closingTag;
                            i += closingTag.length;
                            dollarQuoteTag = "";
                            continue;
                        }
                    } else {
                        if (i + 1 < sqlScript.length && sqlScript[i + 1] === '$') {
                            inDollarQuote = false;
                            currentStatement += "$$";
                            i += 2;
                            continue;
                        }
                    }
                }
            }

            // 处理字符串
            if ((char === "'" || char === '"') && !inComment && !inDollarQuote) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar && (i === 0 || sqlScript[i - 1] !== "\\")) {
                    inString = false;
                }
                currentStatement += char;
            }
            // 处理注释
            else if (!inString && !inDollarQuote && char === '-' && i + 1 < sqlScript.length && sqlScript[i + 1] === '-') {
                // 跳过注释直到行尾
                while (i < sqlScript.length && sqlScript[i] !== '\n') {
                    i++;
                }
                continue;
            }
            // 处理语句分隔符
            else if (char === ";" && !inString && !inComment && !inDollarQuote) {
                currentStatement += char;
                statements.push(currentStatement);
                currentStatement = "";
            }
            else {
                currentStatement += char;
            }

            i++;
        }

        // 添加最后一个语句
        if (currentStatement.trim()) {
            statements.push(currentStatement);
        }

        return statements;
    }

    async close(): Promise<void> {
        return await this.db.destroy();
    }
}
