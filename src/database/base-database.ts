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

        console.log(`Executing ${statements.length} SQL statements...`);

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
                        error.code === "42710" || // duplicate_object
                        error.code === "42P06" || // duplicate_schema
                        error.code === "42701"; // duplicate_column

                    if (isIgnorableError) {
                        // 忽略这些错误
                        console.log(`Ignored duplicate error: ${error.message?.substring(0, 100)}`);
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

                    // 如果错误包含 "undefined table"，可以忽略（通常在删除索引时）
                    if (error.message?.includes("undefined table")) {
                        console.log(`Note: Undefined table (ignoring):`, error.message);
                        continue;
                    }

                    // 如果错误包含 "does not exist" 且不是 42P01，通常可以忽略
                    if (error.message?.includes("does not exist") && !error.message.includes("Required table")) {
                        console.log(`Note: Object does not exist (ignoring):`, error.message);
                        continue;
                    }

                    console.error("Error executing SQL statement:", error.message);
                    console.error("Error code:", error.code);
                    console.error("Statement:", statement.substring(0, 300) + "...");
                    console.error("Full statement length:", statement.length);
                    throw error;
                }
            }
        }

        // 验证关键表是否已创建
        await this.verifyTables();

        // 启用实时聚合
        await this.enableRealtimeAggregation();

        console.log("✓ TimescaleDB tables initialized successfully");
    }

    // 验证关键表是否存在
    private async verifyTables(): Promise<void> {
        const requiredTables = ['systems', 'runs', 'feedback', 'attachments'];

        for (const tableName of requiredTables) {
            try {
                const result = await sql<{ exists: boolean }>`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = ${sql.raw(`'${tableName}'`)}
                    )
                `.execute(this.db);

                const exists = result.rows[0]?.exists;
                if (!exists) {
                    console.error(`Required table '${tableName}' does not exist after initialization`);
                    console.error(`Please check database initialization logs above`);
                    throw new Error(`Required table '${tableName}' does not exist after initialization`);
                } else {
                    console.log(`✓ Verified table '${tableName}' exists`);
                }
            } catch (error) {
                console.error(`Error verifying table '${tableName}':`, error);
                throw error;
            }
        }
    }

    // 启用实时聚合
    private async enableRealtimeAggregation(): Promise<void> {
        console.log("Enabling real-time aggregation for continuous aggregates...");

        const views = ['run_stats_hourly', 'run_stats_15min', 'run_stats_daily', 'run_stats_weekly', 'run_stats_monthly'];

        for (const viewName of views) {
            try {
                // 检查视图是否存在
                const result = await sql<{ exists: boolean }>`
                    SELECT EXISTS (
                        SELECT 1 FROM timescaledb_information.continuous_aggregates
                        WHERE view_name = ${sql.raw(`'${viewName}'`)}
                    )
                `.execute(this.db);

                const exists = result.rows[0]?.exists;

                if (exists) {
                    // 启用实时聚合 - 直接使用字符串插值，避免 sql.raw 嵌套问题
                    const enableSql = `ALTER MATERIALIZED VIEW ${viewName} SET (timescaledb.materialized_only = false)`;
                    await sql.raw(enableSql).execute(this.db);
                    console.log(`✓ Enabled real-time aggregation for ${viewName}`);
                } else {
                    console.log(`Note: Continuous aggregate ${viewName} does not exist, skipping`);
                }
            } catch (error: any) {
                // 忽略错误，可能是视图不存在
                if (error.message?.includes("does not exist") || error.code === "42P01") {
                    console.log(`Note: Continuous aggregate ${viewName} does not exist, skipping`);
                } else {
                    console.log(`Warning: Could not enable real-time aggregation for ${viewName}:`, error.message);
                }
            }
        }
    }

    // 分割 SQL 语句
    private splitSqlStatements(sqlScript: string): string[] {
        const statements: string[] = [];
        let currentStatement = "";
        let inString = false;
        let inComment = false;
        let inDoBlock = false;
        let inFunctionBody = false;
        let inDollarQuoteString = false; // $$ 字符串
        let stringChar = "";
        let dollarQuoteTag = "";
        let dollarQuoteStack: string[] = []; // 用于处理嵌套的 $$ 分隔符

        let i = 0;
        while (i < sqlScript.length) {
            const char = sqlScript[i];

            // 处理 DO 块（PL/pgSQL 块）
            if (!inString && !inComment && !inFunctionBody && !inDollarQuoteString &&
                sqlScript.substring(i, i + 5) === "DO $$" &&
                (i === 0 || /\s/.test(sqlScript[i - 1]))) {
                inDoBlock = true;
                dollarQuoteStack.push("DO$$");
                currentStatement += "DO $$";
                i += 5;
                continue;
            }

            // 处理 DO 块的结束
            if (inDoBlock && sqlScript.substring(i, i + 2) === "$$") {
                // 检查后面是否有 ; 和可能的空格
                let endPos = i + 2;
                while (endPos < sqlScript.length && /\s/.test(sqlScript[endPos])) {
                    endPos++;
                }
                if (endPos < sqlScript.length && sqlScript[endPos] === ';') {
                    currentStatement += "$$;";
                    statements.push(currentStatement.trim());
                    currentStatement = "";
                    inDoBlock = false;
                    dollarQuoteStack.pop();
                    i = endPos + 1;
                    continue;
                }
            }

            // 处理函数/存储过程的 AS $$ ... $$ LANGUAGE plpgsql; 结构
            // 注意：这个检查必须在普通的 $$ 字符串检查之前
            if (!inString && !inComment && !inDoBlock && !inFunctionBody && !inDollarQuoteString &&
                sqlScript.substring(i, i + 5) === "AS $$") {
                inFunctionBody = true;
                dollarQuoteStack.push("AS$$");
                currentStatement += "AS $$";
                i += 5;
                continue;
            }

            // 处理函数体的结束（$$ LANGUAGE plpgsql;）
            // 注意：这个检查必须在普通的 $$ 字符串结束检查之前
            // 关键修复：必须至少有一个空格字符才能认为是函数结束
            if (inFunctionBody && sqlScript.substring(i, i + 2) === "$$") {
                let endPos = i + 2;
                let hasWhitespace = false;
                while (endPos < sqlScript.length && /\s/.test(sqlScript[endPos])) {
                    hasWhitespace = true;
                    endPos++;
                }
                if (hasWhitespace && endPos < sqlScript.length) {
                    const nextKeyword = sqlScript.substring(endPos, endPos + 8);
                    if (nextKeyword === "LANGUAGE") {
                        // 这是函数体的结束（$$ LANGUAGE plpgsql;）
                        currentStatement += "$$";

                        // 添加跳过的空白字符，保持 SQL 语法正确
                        currentStatement += sqlScript.substring(i + 2, endPos);

                        // 继续读取直到分号
                        while (endPos < sqlScript.length && sqlScript[endPos] !== ';') {
                            currentStatement += sqlScript[endPos];
                            endPos++;
                        }
                        if (endPos < sqlScript.length) {
                            currentStatement += ';';
                        }

                        statements.push(currentStatement.trim());
                        currentStatement = "";
                        dollarQuoteStack.pop();
                        inFunctionBody = false;
                        i = endPos + 1;
                        continue;
                    }
                }
            }

            // 处理 $$ 字符串分隔符（用于其他情况，非函数体和 DO 块）
            // 注意：这个检查必须在 AS $$ 和函数体结束检查之后
            if (!inString && !inComment && !inDoBlock && !inFunctionBody &&
                char === '$' && i + 1 < sqlScript.length && sqlScript[i + 1] === '$') {
                if (!inDollarQuoteString) {
                    // 开始 $$ 字符串
                    // 检查是否有标签（如 $$tag$$）
                    let tagEnd = i + 2;
                    while (tagEnd < sqlScript.length && sqlScript[tagEnd] !== '$') {
                        tagEnd++;
                    }
                    if (tagEnd + 1 < sqlScript.length && sqlScript[tagEnd] === '$' && sqlScript[tagEnd + 1] === '$') {
                        dollarQuoteTag = sqlScript.slice(i + 2, tagEnd);
                        inDollarQuoteString = true;
                        dollarQuoteStack.push(`$$${dollarQuoteTag}$$`);
                        currentStatement += sqlScript.slice(i, tagEnd + 2);
                        i = tagEnd + 2;
                        continue;
                    } else {
                        // 只是 $$ 字符串
                        inDollarQuoteString = true;
                        dollarQuoteStack.push("$$");
                        currentStatement += "$$";
                        i += 2;
                        continue;
                    }
                } else {
                    // 结束 $$ 字符串
                    const openingQuote = dollarQuoteStack[dollarQuoteStack.length - 1];
                    if (sqlScript.substring(i, i + 2) === "$$") {
                        currentStatement += "$$";
                        dollarQuoteStack.pop();
                        inDollarQuoteString = false;
                        i += 2;
                        continue;
                    }
                }
            }

            // 处理普通字符串
            if (!inComment && !inDoBlock && !inFunctionBody && !inDollarQuoteString && (char === "'" || char === '"')) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    // 检查是否是转义字符
                    if (sqlScript[i - 1] !== '\\') {
                        inString = false;
                    }
                }
                currentStatement += char;
                i++;
                continue;
            }

            // 函数体内的字符串处理
            if (inFunctionBody && !inDollarQuoteString && (char === "'" || char === '"')) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    // PL/pgSQL 中的转义字符是 ''
                    if (sqlScript[i - 1] !== "'") {
                        inString = false;
                    }
                }
                currentStatement += char;
                i++;
                continue;
            }

            // DO 块内的字符串处理
            if (inDoBlock && !inDollarQuoteString && (char === "'" || char === '"')) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    // PL/pgSQL 中的转义字符是 ''
                    if (sqlScript[i - 1] !== "'") {
                        inString = false;
                    }
                }
                currentStatement += char;
                i++;
                continue;
            }

            // 处理注释
            if (!inString && !inDoBlock && !inFunctionBody && !inDollarQuoteString) {
                if (char === '-' && i + 1 < sqlScript.length && sqlScript[i + 1] === '-') {
                    inComment = true;
                    // 跳过注释直到行尾
                    while (i < sqlScript.length && sqlScript[i] !== '\n') {
                        i++;
                    }
                    inComment = false;
                    continue;
                }
                if (char === '/' && i + 1 < sqlScript.length && sqlScript[i + 1] === '*') {
                    inComment = true;
                    i += 2;
                    while (i < sqlScript.length && !(sqlScript[i] === '*' && sqlScript[i + 1] === '/')) {
                        i++;
                    }
                    i += 2; // 跳过 */
                    inComment = false;
                    continue;
                }
            }

            // 处理分号（不在 DO 块、函数体、字符串或 $$ 字符串内）
            if (!inString && !inComment && !inDoBlock && !inFunctionBody && !inDollarQuoteString && char === ';') {
                currentStatement += char;
                statements.push(currentStatement.trim());
                currentStatement = "";
                i++;
                continue;
            }

            currentStatement += char;
            i++;
        }

        // 添加最后一个语句
        if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
        }

        return statements;
    }
}
