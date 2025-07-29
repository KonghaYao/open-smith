import type { DatabaseAdapter } from "../interfaces.js";
import type { TraceOverview } from "../../types.js";

export class TraceRepository {
    constructor(private adapter: DatabaseAdapter) {}

    // 获取所有 traceId 及其概要信息
    async getAllTraces(): Promise<TraceOverview[]> {
        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(created_at) as first_run_time,
                MAX(created_at) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ","
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ","
                )} as systems,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            WHERE trace_id IS NOT NULL 
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
        `);

        const traces = (await stmt.all()) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                };
            })
        );
    }

    // 根据系统过滤获取 traces
    async getTracesBySystem(system: string): Promise<TraceOverview[]> {
        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(start_time) as first_run_time,
                MAX(end_time) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ","
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ","
                )} as systems,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            WHERE trace_id IS NOT NULL AND system = ${this.adapter.getPlaceholder(
                1
            )}
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
        `);

        const traces = (await stmt.all([system])) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                };
            })
        );
    }

    // 根据线程ID获取相关的 traces
    async getTracesByThreadId(threadId: string): Promise<TraceOverview[]> {
        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(start_time) as first_run_time,
                MAX(end_time) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ","
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ","
                )} as systems,
                SUM(total_tokens) as total_tokens_sum,
                MIN(user_id) as user_id
            FROM runs 
            WHERE trace_id IS NOT NULL AND thread_id = ${this.adapter.getPlaceholder(
                1
            )}
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
        `);

        const traces = (await stmt.all([threadId])) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                    user_id: trace.user_id,
                };
            })
        );
    }

    // 根据用户ID获取相关的 traces
    async getTracesByUserId(userId: string): Promise<TraceOverview[]> {
        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(start_time) as first_run_time,
                MAX(end_time) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ","
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ","
                )} as systems,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            WHERE trace_id IS NOT NULL AND user_id = ${this.adapter.getPlaceholder(
                1
            )}
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
        `);

        const traces = (await stmt.all([userId])) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                };
            })
        );
    }

    // 获取线程ID概览信息 - 统一的查询方法，支持可选过滤条件
    async getThreadOverviews(
        filters?: {
            system?: string;
            thread_id?: string;
        },
        limit?: number,
        offset?: number
    ): Promise<Array<TraceOverview>> {
        const whereConditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        // 基础条件
        whereConditions.push("thread_id IS NOT NULL AND thread_id != ''");

        // 可选过滤条件
        if (filters?.system) {
            whereConditions.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(filters.system);
        }

        if (filters?.thread_id) {
            whereConditions.push(
                `thread_id LIKE ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(`%${filters.thread_id}%`);
        }

        const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

        const stmt = await this.adapter.prepare(`
            SELECT 
                thread_id,
                COUNT(*) as total_runs,
                COUNT(DISTINCT trace_id) as total_traces,
                MIN(created_at) as first_run_time,
                MAX(created_at) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ","
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ","
                )} as systems,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            ${whereClause}
            GROUP BY thread_id 
            ORDER BY MAX(created_at) DESC
            ${
                limit !== undefined
                    ? `LIMIT ${this.adapter.getPlaceholder(paramIndex++)}`
                    : ""
            }
            ${
                offset !== undefined
                    ? `OFFSET ${this.adapter.getPlaceholder(paramIndex++)}`
                    : ""
            }
        `);

        if (limit !== undefined) {
            values.push(limit);
        }
        if (offset !== undefined) {
            values.push(offset);
        }

        const threads = (await stmt.all(values)) as any[];

        return Promise.all(
            threads.map(async (thread: any) => {
                // 获取该 thread 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM feedback f
                JOIN runs r ON f.run_id = r.id 
                WHERE r.thread_id = ${this.adapter.getPlaceholder(1)}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.thread_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    thread.thread_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    thread.thread_id,
                ])) as any;

                return {
                    thread_id: thread.thread_id,
                    trace_id: thread.trace_id,
                    total_runs: thread.total_runs,
                    total_traces: thread.total_traces,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: thread.first_run_time,
                    last_run_time: thread.last_run_time,
                    run_types: thread.run_types
                        ? thread.run_types.split(",").filter(Boolean)
                        : [],
                    systems: thread.systems
                        ? thread.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: thread.total_tokens_sum || 0,
                };
            })
        );
    }

    // 获取指定条件的 traces，支持分页和多个过滤条件
    async getTracesByConditions(
        conditions: {
            system?: string;
            thread_id?: string;
            user_id?: string;
            run_type?: string;
            model_name?: string;
        },
        limit: number,
        offset: number
    ): Promise<TraceOverview[]> {
        const whereConditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (conditions.system) {
            whereConditions.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.system);
        }
        if (conditions.thread_id) {
            whereConditions.push(
                `thread_id = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.thread_id);
        }
        if (conditions.user_id) {
            whereConditions.push(
                `user_id = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.user_id);
        }
        if (conditions.run_type) {
            whereConditions.push(
                `run_type = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.run_type);
        }
        if (conditions.model_name) {
            whereConditions.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.model_name);
        }

        const whereClause =
            whereConditions.length > 0
                ? `WHERE trace_id IS NOT NULL AND ${whereConditions.join(
                      " AND "
                  )}`
                : "WHERE trace_id IS NOT NULL";

        values.push(limit, offset);

        const stmt = await this.adapter.prepare(`
            SELECT 
                trace_id,
                COUNT(*) as total_runs,
                MIN(created_at) as first_run_time,
                MAX(created_at) as last_run_time,
                ${this.adapter.getStringAggregateFunction(
                    "run_type",
                    true,
                    ","
                )} as run_types,
                ${this.adapter.getStringAggregateFunction(
                    "system",
                    true,
                    ","
                )} as systems,
                ${this.adapter.getStringAggregateFunction(
                    "user_id",
                    true,
                    ","
                )} as user_ids,
                SUM(total_tokens) as total_tokens_sum
            FROM runs 
            ${whereClause}
            GROUP BY trace_id 
            ORDER BY MAX(created_at) DESC
            LIMIT ${this.adapter.getPlaceholder(paramIndex++)} 
            OFFSET ${this.adapter.getPlaceholder(paramIndex++)}
        `);

        const traces = (await stmt.all(values)) as any[];

        return Promise.all(
            traces.map(async (trace: any) => {
                // 获取该 trace 的 feedback 和 attachments 统计
                const feedbackStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count FROM feedback WHERE trace_id = ${this.adapter.getPlaceholder(
                    1
                )}
            `);
                const attachmentStmt = await this.adapter.prepare(`
                SELECT COUNT(*) as count 
                FROM attachments a
                JOIN runs r ON a.run_id = r.id 
                WHERE r.trace_id = ${this.adapter.getPlaceholder(1)}
            `);

                const feedbackCount = (await feedbackStmt.get([
                    trace.trace_id,
                ])) as any;
                const attachmentCount = (await attachmentStmt.get([
                    trace.trace_id,
                ])) as any;

                return {
                    trace_id: trace.trace_id,
                    total_runs: trace.total_runs,
                    total_feedback: feedbackCount.count,
                    total_attachments: attachmentCount.count,
                    first_run_time: trace.first_run_time,
                    last_run_time: trace.last_run_time,
                    run_types: trace.run_types
                        ? Array.from(
                              new Set(
                                  trace.run_types.split(",").filter(Boolean)
                              )
                          )
                        : [],
                    systems: trace.systems
                        ? Array.from(
                              new Set(trace.systems.split(",").filter(Boolean))
                          )
                        : [],
                    user_ids: trace.user_ids
                        ? Array.from(
                              new Set(trace.user_ids.split(",").filter(Boolean))
                          )
                        : [],
                    total_tokens_sum: trace.total_tokens_sum || 0,
                };
            })
        );
    }

    // 获取指定条件的 traces 总数
    async countTracesByConditions(conditions: {
        system?: string;
        thread_id?: string;
        user_id?: string;
        run_type?: string;
        model_name?: string;
    }): Promise<number> {
        const whereConditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (conditions.system) {
            whereConditions.push(
                `system = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.system);
        }
        if (conditions.thread_id) {
            whereConditions.push(
                `thread_id = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.thread_id);
        }
        if (conditions.user_id) {
            whereConditions.push(
                `user_id = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.user_id);
        }
        if (conditions.run_type) {
            whereConditions.push(
                `run_type = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.run_type);
        }
        if (conditions.model_name) {
            whereConditions.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            values.push(conditions.model_name);
        }

        const whereClause =
            whereConditions.length > 0
                ? `WHERE trace_id IS NOT NULL AND ${whereConditions.join(
                      " AND "
                  )}`
                : "WHERE trace_id IS NOT NULL";

        const stmt = await this.adapter.prepare(`
            SELECT COUNT(DISTINCT trace_id) as count
            FROM runs
            ${whereClause}
        `);
        const result = (await stmt.get(values)) as { count: number };
        return result.count || 0;
    }
}
