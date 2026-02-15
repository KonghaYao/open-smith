import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../schema.js";
import type { TraceOverview } from "../../types.js";
import { getStringAgg } from "../query-utils.js";

type RawTrace = {
    trace_id: string;
    total_runs: number;
    first_run_time: Date;
    last_run_time: Date;
    run_types: string;
    systems: string;
    total_tokens_sum: number;
    user_id?: string;
    thread_id?: string;
    total_traces?: number;
    user_ids?: string;
};

export class TraceRepository {
    constructor(private db: Kysely<Database>) {}

    // 获取所有 traceId 及其概要信息
    async getAllTraces(): Promise<TraceOverview[]> {
        const traces = await this.db
            .selectFrom("runs")
            .select(({ fn }) => [
                "trace_id",
                fn.count<number>("id").as("total_runs"),
                fn.min("created_at").as("first_run_time"),
                fn.max("created_at").as("last_run_time"),
                getStringAgg("run_type", true).as("run_types"),
                getStringAgg("system", true).as("systems"),
                fn.sum<number>("total_tokens").as("total_tokens_sum"),
            ])
            .where("trace_id", "is not", null)
            .groupBy("trace_id")
            .orderBy(sql`MAX(created_at)`, "desc")
            .execute();

        return Promise.all(
            traces.map(async (trace) => {
                const feedbackCount = await this.db
                    .selectFrom("feedback")
                    .select(({ fn }) => [fn.count<number>("id").as("count")])
                    .where("trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                const attachmentCount = await this.db
                    .selectFrom("attachments")
                    .innerJoin("runs", "attachments.run_id", "runs.id")
                    .select(({ fn }) => [
                        fn.count<number>("attachments.id").as("count"),
                    ])
                    .where("runs.trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                return {
                    trace_id: trace.trace_id!,
                    total_runs: Number(trace.total_runs),
                    total_feedback: Number(feedbackCount?.count ?? 0),
                    total_attachments: Number(attachmentCount?.count ?? 0),
                    first_run_time: trace.first_run_time
                        ? new Date(trace.first_run_time).toISOString()
                        : "",
                    last_run_time: trace.last_run_time
                        ? new Date(trace.last_run_time).toISOString()
                        : "",
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: Number(trace.total_tokens_sum ?? 0),
                };
            }),
        );
    }

    // 根据系统过滤获取 traces
    async getTracesBySystem(system: string): Promise<TraceOverview[]> {
        const traces = await this.db
            .selectFrom("runs")
            .select(({ fn }) => [
                "trace_id",
                fn.count<number>("id").as("total_runs"),
                fn.min("start_time").as("first_run_time"),
                fn.max("end_time").as("last_run_time"),
                getStringAgg("run_type", true).as("run_types"),
                getStringAgg("system", true).as("systems"),
                fn.sum<number>("total_tokens").as("total_tokens_sum"),
            ])
            .where("trace_id", "is not", null)
            .where("system", "=", system)
            .groupBy("trace_id")
            .orderBy(sql`MAX(created_at)`, "desc")
            .execute();

        return Promise.all(
            traces.map(async (trace) => {
                const feedbackCount = await this.db
                    .selectFrom("feedback")
                    .select(({ fn }) => [fn.count<number>("id").as("count")])
                    .where("trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                const attachmentCount = await this.db
                    .selectFrom("attachments")
                    .innerJoin("runs", "attachments.run_id", "runs.id")
                    .select(({ fn }) => [
                        fn.count<number>("attachments.id").as("count"),
                    ])
                    .where("runs.trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                return {
                    trace_id: trace.trace_id!,
                    total_runs: Number(trace.total_runs),
                    total_feedback: Number(feedbackCount?.count ?? 0),
                    total_attachments: Number(attachmentCount?.count ?? 0),
                    first_run_time: trace.first_run_time
                        ? new Date(trace.first_run_time).toISOString()
                        : "",
                    last_run_time: trace.last_run_time
                        ? new Date(trace.last_run_time).toISOString()
                        : "",
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: Number(trace.total_tokens_sum ?? 0),
                };
            }),
        );
    }

    // 根据线程ID获取相关的 traces
    async getTracesByThreadId(threadId: string): Promise<TraceOverview[]> {
        const traces = await this.db
            .selectFrom("runs")
            .select(({ fn }) => [
                "trace_id",
                fn.count<number>("id").as("total_runs"),
                fn.min("start_time").as("first_run_time"),
                fn.max("end_time").as("last_run_time"),
                getStringAgg("run_type", true).as("run_types"),
                getStringAgg("system", true).as("systems"),
                fn.sum<number>("total_tokens").as("total_tokens_sum"),
                fn.min("user_id").as("user_id"),
            ])
            .where("trace_id", "is not", null)
            .where("thread_id", "=", threadId)
            .groupBy("trace_id")
            .orderBy(sql`MAX(created_at)`, "desc")
            .execute();

        return Promise.all(
            traces.map(async (trace) => {
                const feedbackCount = await this.db
                    .selectFrom("feedback")
                    .select(({ fn }) => [fn.count<number>("id").as("count")])
                    .where("trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                const attachmentCount = await this.db
                    .selectFrom("attachments")
                    .innerJoin("runs", "attachments.run_id", "runs.id")
                    .select(({ fn }) => [
                        fn.count<number>("attachments.id").as("count"),
                    ])
                    .where("runs.trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                return {
                    trace_id: trace.trace_id!,
                    total_runs: Number(trace.total_runs),
                    total_feedback: Number(feedbackCount?.count ?? 0),
                    total_attachments: Number(attachmentCount?.count ?? 0),
                    first_run_time: trace.first_run_time
                        ? new Date(trace.first_run_time).toISOString()
                        : "",
                    last_run_time: trace.last_run_time
                        ? new Date(trace.last_run_time).toISOString()
                        : "",
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: Number(trace.total_tokens_sum ?? 0),
                    user_id: trace.user_id ?? undefined,
                };
            }),
        );
    }

    // 根据用户ID获取相关的 traces
    async getTracesByUserId(userId: string): Promise<TraceOverview[]> {
        const traces = await this.db
            .selectFrom("runs")
            .select(({ fn }) => [
                "trace_id",
                fn.count<number>("id").as("total_runs"),
                fn.min("start_time").as("first_run_time"),
                fn.max("end_time").as("last_run_time"),
                getStringAgg("run_type", true).as("run_types"),
                getStringAgg("system", true).as("systems"),
                fn.sum<number>("total_tokens").as("total_tokens_sum"),
            ])
            .where("trace_id", "is not", null)
            .where("user_id", "=", userId)
            .groupBy("trace_id")
            .orderBy(sql`MAX(created_at)`, "desc")
            .execute();

        return Promise.all(
            traces.map(async (trace) => {
                const feedbackCount = await this.db
                    .selectFrom("feedback")
                    .select(({ fn }) => [fn.count<number>("id").as("count")])
                    .where("trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                const attachmentCount = await this.db
                    .selectFrom("attachments")
                    .innerJoin("runs", "attachments.run_id", "runs.id")
                    .select(({ fn }) => [
                        fn.count<number>("attachments.id").as("count"),
                    ])
                    .where("runs.trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                return {
                    trace_id: trace.trace_id!,
                    total_runs: Number(trace.total_runs),
                    total_feedback: Number(feedbackCount?.count ?? 0),
                    total_attachments: Number(attachmentCount?.count ?? 0),
                    first_run_time: trace.first_run_time
                        ? new Date(trace.first_run_time).toISOString()
                        : "",
                    last_run_time: trace.last_run_time
                        ? new Date(trace.last_run_time).toISOString()
                        : "",
                    run_types: trace.run_types
                        ? trace.run_types.split(",").filter(Boolean)
                        : [],
                    systems: trace.systems
                        ? trace.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: Number(trace.total_tokens_sum ?? 0),
                };
            }),
        );
    }

    // 获取线程ID概览信息 - 统一的查询方法，支持可选过滤条件
    async getThreadOverviews(
        filters?: {
            system?: string;
            thread_id?: string;
        },
        limit?: number,
        offset?: number,
    ): Promise<Array<TraceOverview>> {
        let query = this.db
            .selectFrom("runs")
            .select(({ fn }) => [
                "thread_id",
                fn.count<number>("id").as("total_runs"),
                sql<number>`COUNT(DISTINCT trace_id)`.as("total_traces"),
                fn.min("created_at").as("first_run_time"),
                fn.max("created_at").as("last_run_time"),
                getStringAgg("run_type", true).as("run_types"),
                getStringAgg("system", true).as("systems"),
                fn.sum<number>("total_tokens").as("total_tokens_sum"),
            ])
            .where("thread_id", "is not", null)
            .where("thread_id", "!=", "");

        if (filters?.system) {
            query = query.where("system", "=", filters.system);
        }

        if (filters?.thread_id) {
            query = query.where("thread_id", "like", `%${filters.thread_id}%`);
        }

        query = query
            .groupBy("thread_id")
            .orderBy(sql`MAX(created_at)`, "desc");

        if (limit !== undefined) {
            query = query.limit(limit);
        }

        if (offset !== undefined) {
            query = query.offset(offset);
        }

        const threads = await query.execute();

        return Promise.all(
            threads.map(async (thread) => {
                const feedbackCount = await this.db
                    .selectFrom("feedback")
                    .innerJoin("runs", "feedback.run_id", "runs.id")
                    .select(({ fn }) => [
                        fn.count<number>("feedback.id").as("count"),
                    ])
                    .where("runs.thread_id", "=", thread.thread_id!)
                    .executeTakeFirst();

                const attachmentCount = await this.db
                    .selectFrom("attachments")
                    .innerJoin("runs", "attachments.run_id", "runs.id")
                    .select(({ fn }) => [
                        fn.count<number>("attachments.id").as("count"),
                    ])
                    .where("runs.thread_id", "=", thread.thread_id!)
                    .executeTakeFirst();

                return {
                    thread_id: thread.thread_id!,
                    trace_id: "", // thread overview 没有单一的 trace_id
                    total_runs: Number(thread.total_runs),
                    total_traces: Number(thread.total_traces ?? 0),
                    total_feedback: Number(feedbackCount?.count ?? 0),
                    total_attachments: Number(attachmentCount?.count ?? 0),
                    first_run_time: thread.first_run_time
                        ? new Date(thread.first_run_time).toISOString()
                        : "",
                    last_run_time: thread.last_run_time
                        ? new Date(thread.last_run_time).toISOString()
                        : "",
                    run_types: thread.run_types
                        ? thread.run_types.split(",").filter(Boolean)
                        : [],
                    systems: thread.systems
                        ? thread.systems.split(",").filter(Boolean)
                        : [],
                    total_tokens_sum: Number(thread.total_tokens_sum ?? 0),
                };
            }),
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
        offset: number,
    ): Promise<TraceOverview[]> {
        let query = this.db
            .selectFrom("runs")
            .select(({ fn }) => [
                "trace_id",
                fn.count<number>("id").as("total_runs"),
                fn.min("created_at").as("first_run_time"),
                fn.max("created_at").as("last_run_time"),
                getStringAgg("run_type", true).as("run_types"),
                getStringAgg("system", true).as("systems"),
                getStringAgg("user_id", true).as("user_ids"),
                fn.sum<number>("total_tokens").as("total_tokens_sum"),
            ])
            .where("trace_id", "is not", null);

        if (conditions.system) {
            query = query.where("system", "=", conditions.system);
        }
        if (conditions.thread_id) {
            query = query.where("thread_id", "=", conditions.thread_id);
        }
        if (conditions.user_id) {
            query = query.where("user_id", "=", conditions.user_id);
        }
        if (conditions.run_type) {
            query = query.where("run_type", "=", conditions.run_type);
        }
        if (conditions.model_name) {
            query = query.where("model_name", "=", conditions.model_name);
        }

        const traces = await query
            .groupBy("trace_id")
            .orderBy(sql`MAX(created_at)`, "desc")
            .limit(limit)
            .offset(offset)
            .execute();

        return Promise.all(
            traces.map(async (trace) => {
                const feedbackCount = await this.db
                    .selectFrom("feedback")
                    .select(({ fn }) => [fn.count<number>("id").as("count")])
                    .where("trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                const attachmentCount = await this.db
                    .selectFrom("attachments")
                    .innerJoin("runs", "attachments.run_id", "runs.id")
                    .select(({ fn }) => [
                        fn.count<number>("attachments.id").as("count"),
                    ])
                    .where("runs.trace_id", "=", trace.trace_id!)
                    .executeTakeFirst();

                return {
                    trace_id: trace.trace_id!,
                    total_runs: Number(trace.total_runs),
                    total_feedback: Number(feedbackCount?.count ?? 0),
                    total_attachments: Number(attachmentCount?.count ?? 0),
                    first_run_time: trace.first_run_time
                        ? new Date(trace.first_run_time).toISOString()
                        : "",
                    last_run_time: trace.last_run_time
                        ? new Date(trace.last_run_time).toISOString()
                        : "",
                    run_types: trace.run_types
                        ? Array.from(
                              new Set(
                                  trace.run_types.split(",").filter(Boolean),
                              ),
                          )
                        : [],
                    systems: trace.systems
                        ? Array.from(
                              new Set(trace.systems.split(",").filter(Boolean)),
                          )
                        : [],
                    user_ids: trace.user_ids
                        ? Array.from(
                              new Set(
                                  trace.user_ids.split(",").filter(Boolean),
                              ),
                          )
                        : [],
                    total_tokens_sum: Number(trace.total_tokens_sum ?? 0),
                };
            }),
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
        let query = this.db
            .selectFrom("runs")
            .select(({ fn }) => [
                sql<number>`COUNT(DISTINCT trace_id)`.as("count"),
            ])
            .where("trace_id", "is not", null);

        if (conditions.system) {
            query = query.where("system", "=", conditions.system);
        }
        if (conditions.thread_id) {
            query = query.where("thread_id", "=", conditions.thread_id);
        }
        if (conditions.user_id) {
            query = query.where("user_id", "=", conditions.user_id);
        }
        if (conditions.run_type) {
            query = query.where("run_type", "=", conditions.run_type);
        }
        if (conditions.model_name) {
            query = query.where("model_name", "=", conditions.model_name);
        }

        const result = await query.executeTakeFirst();
        return Number(result?.count ?? 0);
    }
}
