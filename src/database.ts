// 重新导出新的模块化数据库类
export { TraceDatabase } from "./database/index.js";
export type { Database } from "./database/schema.js";
export type { Kysely } from "kysely";
export { createKyselyInstance } from "./database/kysely-dialects.js";
