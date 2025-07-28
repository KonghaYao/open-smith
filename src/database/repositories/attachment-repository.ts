import { v4 as uuidv4 } from "uuid";
import type { DatabaseAdapter } from "../interfaces.js";
import type { AttachmentRecord } from "../../types.js";

export class AttachmentRepository {
    constructor(private adapter: DatabaseAdapter) {}

    // 创建附件
    async createAttachment(
        runId: string,
        filename: string,
        contentType: string,
        fileSize: number,
        storagePath: string
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

        const stmt = await this.adapter.prepare(`
            INSERT INTO attachments (
                id, run_id, filename, content_type, file_size, storage_path, created_at
            ) VALUES (${this.adapter.getPlaceholder(
                1
            )}, ${this.adapter.getPlaceholder(
            2
        )}, ${this.adapter.getPlaceholder(3)}, ${this.adapter.getPlaceholder(
            4
        )}, ${this.adapter.getPlaceholder(5)}, ${this.adapter.getPlaceholder(
            6
        )}, ${this.adapter.getPlaceholder(7)})
        `);

        await stmt.run([
            record.id,
            record.run_id,
            record.filename,
            record.content_type,
            record.file_size,
            record.storage_path,
            record.created_at,
        ]);

        return record;
    }

    // 根据 run_id 获取附件
    async getAttachmentsByRunId(runId: string): Promise<AttachmentRecord[]> {
        const stmt = await this.adapter.prepare(
            `SELECT * FROM attachments WHERE run_id = ${this.adapter.getPlaceholder(
                1
            )} ORDER BY created_at`
        );
        return (await stmt.all([runId])) as AttachmentRecord[];
    }
}
