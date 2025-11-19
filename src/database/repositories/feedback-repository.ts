import { v4 as uuidv4 } from "uuid";
import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { FeedbackRecord } from "../../types.js";
import type { FeedbackPayload } from "../../multipart-types.js";

export class FeedbackRepository {
    constructor(private db: Kysely<Database>) {}

    // 创建反馈
    async createFeedback(
        runId: string,
        feedbackData: FeedbackPayload,
    ): Promise<FeedbackRecord> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const record: FeedbackRecord = {
            id,
            trace_id: feedbackData.trace_id,
            run_id: runId,
            feedback_id: feedbackData.feedback_id,
            score: feedbackData.score,
            comment: feedbackData.comment,
            metadata: feedbackData.metadata
                ? JSON.stringify(feedbackData.metadata)
                : undefined,
            created_at: now,
        };

        await this.db
            .insertInto("feedback")
            .values({
                id: record.id,
                trace_id: record.trace_id,
                run_id: record.run_id,
                feedback_id: record.feedback_id ?? null,
                score: record.score ?? null,
                comment: record.comment ?? null,
                metadata: record.metadata ?? null,
                created_at: record.created_at,
            })
            .execute();

        return record;
    }

    // 根据 run_id 获取反馈
    async getFeedbackByRunId(runId: string): Promise<FeedbackRecord[]> {
        const results = await this.db
            .selectFrom("feedback")
            .selectAll()
            .where("run_id", "=", runId)
            .orderBy("created_at")
            .execute();

        return results.map((r) => ({
            ...r,
            feedback_id: r.feedback_id ?? undefined,
            score: r.score ?? undefined,
            comment: r.comment ?? undefined,
            metadata: r.metadata ?? undefined,
        }));
    }
}
