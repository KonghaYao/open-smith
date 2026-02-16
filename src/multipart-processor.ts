import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { MultipartConfig, RunPayload, FeedbackPayload } from './multipart-types.js';
import { MultipartParser } from './multipart-types.js';
import { TraceDatabase } from './database.js';
import multipartConfig from './multipart-config.json' with { type: 'json' };


export interface ProcessingResult {
  success: boolean;
  message: string;
  data?: {
    runs_created: number;
    runs_updated: number;
    fields_updated: number;
    feedback_created: number;
    attachments_stored: number;
  };
  errors?: string[];
}

export class MultipartProcessor {
  private db: TraceDatabase;
  private parser: MultipartParser;
  private config: MultipartConfig;
  private attachmentDir: string;

  constructor(db: TraceDatabase, attachmentDir: string = './attachments') {
    this.db = db;
    this.config = multipartConfig as MultipartConfig;
    this.parser = new MultipartParser(this.config);
    this.attachmentDir = attachmentDir;
  }

  async processMultipartData(formData: FormData, system?: string): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      success: true,
      message: 'Processing completed',
      data: {
        runs_created: 0,
        runs_updated: 0,
        fields_updated: 0,
        feedback_created: 0,
        attachments_stored: 0,
      },
      errors: [],
    };

    try {
      // 确保附件目录存在
      await mkdir(this.attachmentDir, { recursive: true });

      // 第一阶段：收集所有数据，按照 runId 分组
      const runCreates = new Map<string, { data: RunPayload; fields: Map<string, unknown> }>();
      const runUpdates = new Map<string, { data: RunPayload; fields: Map<string, unknown> }>();
      const feedbacks = new Map<string, FeedbackPayload>();
      const attachments = new Map<string, { filename: string; data: File; contentType: string; fileSize: number }[]>();

      for (const [name, value] of formData.entries()) {
        try {
          const parsed = this.parser.parsePartName(name);
          if (!parsed) {
            result.errors?.push(`Invalid part name: ${name}`);
            continue;
          }

          parsed.data = value;

          switch (parsed.event) {
            case 'post':
              if (parsed.field) {
                // 收集创建时附带的字段
                if (!runCreates.has(parsed.runId)) {
                  runCreates.set(parsed.runId, { data: {} as RunPayload, fields: new Map() });
                }
                const runEntry = runCreates.get(parsed.runId)!;
                const fieldData = typeof value === 'string' ? JSON.parse(value) : value;
                runEntry.fields.set(parsed.field, fieldData);
              } else {
                // 创建 run 的主数据
                if (!runCreates.has(parsed.runId)) {
                  runCreates.set(parsed.runId, { data: {} as RunPayload, fields: new Map() });
                }
                if (typeof value === 'string') {
                  runCreates.get(parsed.runId)!.data = JSON.parse(value);
                }
              }
              break;

            case 'patch':
              if (parsed.field) {
                // 收集更新时的字段
                if (!runUpdates.has(parsed.runId)) {
                  runUpdates.set(parsed.runId, { data: {} as RunPayload, fields: new Map() });
                }
                const runEntry = runUpdates.get(parsed.runId)!;
                const fieldData = typeof value === 'string' ? JSON.parse(value) : value;
                runEntry.fields.set(parsed.field, fieldData);
              } else {
                // 更新 run 的主数据
                if (!runUpdates.has(parsed.runId)) {
                  runUpdates.set(parsed.runId, { data: {} as RunPayload, fields: new Map() });
                }
                if (typeof value === 'string') {
                  runUpdates.get(parsed.runId)!.data = JSON.parse(value);
                }
              }
              break;

            case 'feedback':
              if (typeof value === 'string') {
                feedbacks.set(parsed.runId, JSON.parse(value));
              }
              break;

            case 'attachment':
              if (value instanceof File) {
                if (!attachments.has(parsed.runId)) {
                  attachments.set(parsed.runId, []);
                }
                attachments.get(parsed.runId)!.push({
                  filename: parsed.filename!,
                  data: value,
                  contentType: value.type || 'application/octet-stream',
                  fileSize: value.size,
                });
              }
              break;
          }
        } catch (error) {
          const errorMessage = `Error processing part ${name}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(error);
          result.errors?.push(errorMessage);
        }
      }

      // 第二阶段：批量处理数据
      // 处理创建 run
      for (const [runId, entry] of runCreates) {
        try {
          const runData = entry.data;
          runData.id = runId; // 确保 ID 匹配
          runData.system = system; // 设置系统标识

          // 合并字段到主数据中
          for (const [field, value] of entry.fields) {
            (runData as any)[field] = value;
          }

          await this.db.createRun(runData);
          result.data!.runs_created++;
        } catch (error) {
          const errorMessage = `Error creating run ${runId}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(error);
          result.errors?.push(errorMessage);
        }
      }

      // 处理更新 run
      for (const [runId, entry] of runUpdates) {
        try {
          const runData = entry.data;
          runData.system = system;

          // 先更新主数据（如果有）
          if (Object.keys(runData).length > 0) {
            const updated = await this.db.updateRun(runId, runData);
            if (updated) {
              result.data!.runs_updated++;
            } else {
              result.errors?.push(`Run ${runId} not found for update`);
              continue;
            }
          }

          // 然后更新各个字段
          for (const [field, value] of entry.fields) {
            const updated = await this.db.updateRunField(runId, field, value);
            if (updated) {
              result.data!.fields_updated++;
            } else {
              result.errors?.push(`Run ${runId} not found for field ${field} update`);
            }
          }
        } catch (error) {
          const errorMessage = `Error updating run ${runId}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(error);
          result.errors?.push(errorMessage);
        }
      }

      // 处理 feedback
      for (const [runId, feedbackData] of feedbacks) {
        try {
          if (!this.parser.validateFeedback(feedbackData)) {
            throw new Error('Feedback must include trace_id');
          }
          await this.db.createFeedback(runId, feedbackData);
          result.data!.feedback_created++;
        } catch (error) {
          const errorMessage = `Error creating feedback for run ${runId}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(error);
          result.errors?.push(errorMessage);
        }
      }

      // 处理 attachments
      for (const [runId, attachmentList] of attachments) {
        for (const attachment of attachmentList) {
          try {
            const storagePath = join(this.attachmentDir, `${runId}_${attachment.filename}`);

            // 存储文件
            const buffer = await attachment.data.arrayBuffer();
            await writeFile(storagePath, Buffer.from(buffer));

            // 在数据库中记录附件信息
            await this.db.createAttachment(
              runId,
              attachment.filename,
              attachment.contentType,
              attachment.fileSize,
              storagePath
            );

            result.data!.attachments_stored++;
          } catch (error) {
            const errorMessage = `Error storing attachment ${attachment.filename} for run ${runId}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(error);
            result.errors?.push(errorMessage);
          }
        }
      }

      if (result.errors && result.errors.length > 0) {
        result.success = false;
        result.message = 'Processing completed with errors';
      }

    } catch (error) {
      result.success = false;
      result.message = `Processing failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return result;
  }

  async close(): Promise<void> {
    // await this.db.close();
  }
}
