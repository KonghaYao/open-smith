import { v4 as uuidv4 } from "uuid";
import type { DatabaseAdapter } from "../interfaces.js";
import type { FeedbackRecord } from "../../types.js";
import type { FeedbackPayload } from "../../multipart-types.js";

export class FeedbackRepository {
    constructor(private adapter: DatabaseAdapter) {}

    // 创建反馈
    async createFeedback(
        runId: string,
        feedbackData: FeedbackPayload
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

        const stmt = await this.adapter.prepare(`
            INSERT INTO feedback (
                id, trace_id, run_id, feedback_id, score, comment, metadata, created_at
            ) VALUES (${this.adapter.getPlaceholder(
                1
            )}, ${this.adapter.getPlaceholder(
            2
        )}, ${this.adapter.getPlaceholder(3)}, ${this.adapter.getPlaceholder(
            4
        )}, ${this.adapter.getPlaceholder(5)}, ${this.adapter.getPlaceholder(
            6
        )}, ${this.adapter.getPlaceholder(7)}, ${this.adapter.getPlaceholder(
            8
        )})
        `);

        await stmt.run([
            record.id,
            record.trace_id,
            record.run_id,
            record.feedback_id,
            record.score,
            record.comment,
            record.metadata,
            record.created_at,
        ]);

        return record;
    }

    // 根据 run_id 获取反馈
    async getFeedbackByRunId(runId: string): Promise<FeedbackRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM feedback WHERE run_id = ${this.adapter.getPlaceholder(
                1
            )} ORDER BY created_at`
        );
        return (await stmt.all([runId])) as FeedbackRecord[];
    }
}
