import { v4 as uuidv4 } from "uuid";
import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { AttachmentRecord } from "../../types.js";

export class AttachmentRepository {
    constructor(private db: Kysely<Database>) {}

    // 创建附件
    async createAttachment(
        runId: string,
        filename: string,
        contentType: string,
        fileSize: number,
        storagePath: string,
    ): Promise<AttachmentRecord> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const record: AttachmentRecord = {
            id,
            run_id: runId,
            filename,
            content_type: contentType,
            file_size: fileSize,
            storage_path: storagePath,
            created_at: now,
        };

        await this.db
            .insertInto("attachments")
            .values({
                id: record.id,
                run_id: record.run_id,
                filename: record.filename,
                content_type: record.content_type ?? null,
                file_size: record.file_size ?? null,
                storage_path: record.storage_path ?? null,
                created_at: record.created_at,
            })
            .execute();

        return record;
    }

    // 根据 run_id 获取附件
    async getAttachmentsByRunId(runId: string): Promise<AttachmentRecord[]> {
        const results = await this.db
            .selectFrom("attachments")
            .selectAll()
            .where("run_id", "=", runId)
            .orderBy("created_at")
            .execute();

        return results.map((r) => ({
            ...r,
            content_type: r.content_type ?? "",
            file_size: r.file_size ?? 0,
            storage_path: r.storage_path ?? "",
        }));
    }
}
