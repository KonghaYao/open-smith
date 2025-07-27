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
              await this.handleRunCreate(parsed, result, system);
              break;
            case 'patch':
              await this.handleRunUpdate(parsed, result, system);
              break;
            case 'feedback':
              await this.handleFeedback(parsed, result);
              break;
            case 'attachment':
              await this.handleAttachment(parsed, result);
              break;
          }
        } catch (error) {
          const errorMessage = `Error processing part ${name}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(error);
          result.errors?.push(errorMessage);
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

  private async handleRunCreate(parsed: any, result: ProcessingResult, system?: string): Promise<void> {
    if (parsed.field) {
      // 这是一个 out-of-band 字段
      await this.handleRunFieldUpdate(parsed, result);
      return;
    }

    if (typeof parsed.data === 'string') {
      const runData: RunPayload = JSON.parse(parsed.data);
      runData.id = runData.id || parsed.runId; // 确保 ID 匹配
      runData.system = system; // 设置系统标识
      await this.db.createRun(runData);
      
      result.data!.runs_created++;
    } else {
      throw new Error('Run data must be a string');
    }
  }

  private async handleRunUpdate(parsed: any, result: ProcessingResult, system?: string): Promise<void> {
    if (parsed.field) {
      // 这是一个 out-of-band 字段
      await this.handleRunFieldUpdate(parsed, result);
      return;
    }

    if (typeof parsed.data === 'string') {
      const runData: RunPayload = JSON.parse(parsed.data);
      runData.system = system; // 设置系统标识
      
      const updated = await this.db.updateRun(parsed.runId, runData);
      if (updated) {
        result.data!.runs_updated++;
      } else {
        throw new Error(`Run ${parsed.runId} not found for update`);
      }
    } else {
      throw new Error('Run data must be a string');
    }
  }

  private async handleRunFieldUpdate(parsed: any, result: ProcessingResult): Promise<void> {
    if (!parsed.field) {
      throw new Error('Field name is required');
    }

    if (!this.config.out_of_band_fields.includes(parsed.field)) {
      throw new Error(`Field ${parsed.field} is not allowed for out-of-band storage`);
    }

    if (typeof parsed.data === 'string') {
      const fieldData = JSON.parse(parsed.data);
      
      const updated = await this.db.updateRunField(parsed.runId, parsed.field, fieldData);
      if (updated) {
        result.data!.fields_updated++;
      } else {
        throw new Error(`Run ${parsed.runId} not found for field update`);
      }
    } else {
      throw new Error('Field data must be a string');
    }
  }

  private async handleFeedback(parsed: any, result: ProcessingResult): Promise<void> {
    if (typeof parsed.data === 'string') {
      const feedbackData: FeedbackPayload = JSON.parse(parsed.data);
      
      // 验证 feedback 必须包含 trace_id
      if (!this.parser.validateFeedback(feedbackData)) {
        throw new Error('Feedback must include trace_id');
      }
      
      await this.db.createFeedback(parsed.runId, feedbackData);
      result.data!.feedback_created++;
    } else {
      throw new Error('Feedback data must be a string');
    }
  }

  private async handleAttachment(parsed: any, result: ProcessingResult): Promise<void> {
    if (!parsed.filename) {
      throw new Error('Filename is required for attachments');
    }

    if (parsed.data instanceof File) {
      const file = parsed.data;
      const storagePath = join(this.attachmentDir, `${parsed.runId}_${parsed.filename}`);
      
      // 存储文件
      const buffer = await file.arrayBuffer();
      await writeFile(storagePath, Buffer.from(buffer));
      
      // 在数据库中记录附件信息
      await this.db.createAttachment(
        parsed.runId,
        parsed.filename,
        file.type || 'application/octet-stream',
        file.size,
        storagePath
      );
      
      result.data!.attachments_stored++;
    } else {
      throw new Error('Attachment data must be a File object');
    }
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
