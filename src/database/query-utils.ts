import { sql } from "kysely";
import { dbType } from "./kysely-dialects.js";

// 获取字符串聚合函数（根据数据库类型）
export function getStringAgg(column: string, distinct: boolean = true): any {
    const col = distinct ? sql`DISTINCT ${sql.ref(column)}` : sql.ref(column);

    if (dbType === "pg") {
        return sql<string>`STRING_AGG(${col}, ',')`;
    }

    return sql<string>`GROUP_CONCAT(${col})`;
}
