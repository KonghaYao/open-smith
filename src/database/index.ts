import type { DatabaseAdapter } from "./interfaces.js";
import { BaseDatabase } from "./base-database.js";
import { SystemRepository } from "./repositories/system-repository.js";
import { RunRepository } from "./repositories/run-repository.js";
import { FeedbackRepository } from "./repositories/feedback-repository.js";
import { AttachmentRepository } from "./repositories/attachment-repository.js";
import { TraceRepository } from "./repositories/trace-repository.js";
import { RunStatsRepository } from "./repositories/run-stats-repository.js";

import type { RunPayload, FeedbackPayload } from "../multipart-types.js";
import type {
    TraceOverview,
    SystemRecord,
    RunRecord,
    FeedbackRecord,
    AttachmentRecord,
    RunStatsHourlyRecord,
} from "../types.js";

export class TraceDatabase extends BaseDatabase {
    readonly systemRepo: SystemRepository;
    readonly runRepo: RunRepository;
    readonly feedbackRepo: FeedbackRepository;
    readonly attachmentRepo: AttachmentRepository;
    readonly traceRepo: TraceRepository;
    readonly runStatsRepo: RunStatsRepository;

    constructor(adapter: DatabaseAdapter) {
        super(adapter);
        this.systemRepo = new SystemRepository(adapter);
        this.runRepo = new RunRepository(adapter);
        this.feedbackRepo = new FeedbackRepository(adapter);
        this.attachmentRepo = new AttachmentRepository(adapter);
        this.traceRepo = new TraceRepository(adapter);
        this.runStatsRepo = new RunStatsRepository(adapter);
    }

    // System 相关方法
    async createSystem(
        name: string,
        description?: string,
        apiKey?: string
    ): Promise<SystemRecord> {
        return this.systemRepo.createSystem(name, description, apiKey);
    }

    async getSystemByApiKey(apiKey: string): Promise<SystemRecord | null> {
        return this.systemRepo.getSystemByApiKey(apiKey);
    }

    async getSystemByName(name: string): Promise<SystemRecord | null> {
        return this.systemRepo.getSystemByName(name);
    }

    async getSystemById(id: string): Promise<SystemRecord | null> {
        return this.systemRepo.getSystemById(id);
    }

    async getAllSystemRecords(): Promise<SystemRecord[]> {
        return this.systemRepo.getAllSystemRecords();
    }

    async getActiveSystems(): Promise<SystemRecord[]> {
        return this.systemRepo.getActiveSystems();
    }

    async updateSystemStatus(
        id: string,
        status: "active" | "inactive"
    ): Promise<SystemRecord | null> {
        return this.systemRepo.updateSystemStatus(id, status);
    }

    async updateSystem(
        id: string,
        updates: {
            name?: string;
            description?: string;
            status?: "active" | "inactive";
        }
    ): Promise<SystemRecord | null> {
        return this.systemRepo.updateSystem(id, updates);
    }

    async regenerateApiKey(id: string): Promise<SystemRecord | null> {
        return this.systemRepo.regenerateApiKey(id);
    }

    async deleteSystem(id: string): Promise<boolean> {
        return this.systemRepo.deleteSystem(id);
    }

    async ensureSystemExists(systemName: string): Promise<SystemRecord> {
        return this.systemRepo.ensureSystemExists(systemName);
    }

    async getSystemStats(systemName: string): Promise<{
        total_runs: number;
        total_traces: number;
        total_tokens: number;
        total_feedback: number;
        total_attachments: number;
        first_run_time?: string;
        last_run_time?: string;
    }> {
        return this.systemRepo.getSystemStats(systemName);
    }

    async getAllSystems(): Promise<string[]> {
        return this.systemRepo.getAllSystems();
    }

    async migrateExistingRunsToSystems(): Promise<{
        created: number;
        skipped: number;
    }> {
        return this.systemRepo.migrateExistingRunsToSystems();
    }

    async validateSystemReferences(): Promise<string[]> {
        return this.systemRepo.validateSystemReferences();
    }

    // Run 相关方法
    async createRun(runData: RunPayload): Promise<RunRecord> {
        // 如果提供了系统名称，确保系统存在
        if (runData.system) {
            await this.ensureSystemExists(runData.system);
        }
        return this.runRepo.createRun(runData);
    }

    async updateRun(
        runId: string,
        runData: RunPayload
    ): Promise<RunRecord | null> {
        return this.runRepo.updateRun(runId, runData);
    }

    async updateRunField(
        runId: string,
        field: string,
        value: any,
        json = true
    ): Promise<RunRecord | null> {
        return this.runRepo.updateRunField(runId, field, value, json);
    }

    async getRun(runId: string): Promise<RunRecord | null> {
        return this.runRepo.getRun(runId);
    }

    async getRunsByTraceId(traceId: string): Promise<RunRecord[]> {
        return this.runRepo.getRunsByTraceId(traceId);
    }

    async getRunsBySystem(system: string): Promise<RunRecord[]> {
        return this.runRepo.getRunsBySystem(system);
    }

    async getRunsByThreadId(threadId: string): Promise<RunRecord[]> {
        return this.runRepo.getRunsByThreadId(threadId);
    }

    async getRunsByUserId(userId: string): Promise<RunRecord[]> {
        return this.runRepo.getRunsByUserId(userId);
    }

    async getRunsByRunType(
        runType: string,
        limit: number,
        offset: number
    ): Promise<RunRecord[]> {
        return this.runRepo.getRunsByRunType(runType, limit, offset);
    }

    async countRunsByRunType(runType: string): Promise<number> {
        return this.runRepo.countRunsByRunType(runType);
    }

    async getRunsByConditions(
        conditions: {
            run_type?: string;
            system?: string;
            model_name?: string;
            thread_id?: string;
            user_id?: string;
            tag?: string;
        },
        limit: number,
        offset: number
    ): Promise<RunRecord[]> {
        return this.runRepo.getRunsByConditions(conditions, limit, offset);
    }

    async countRunsByConditions(conditions: {
        run_type?: string;
        system?: string;
        model_name?: string;
        thread_id?: string;
        user_id?: string;
        tag?: string;
    }): Promise<number> {
        return this.runRepo.countRunsByConditions(conditions);
    }

    async getAllThreadIds(): Promise<string[]> {
        return this.runRepo.getAllThreadIds();
    }

    async getAllUserIds(): Promise<string[]> {
        return this.runRepo.getAllUserIds();
    }

    async getAllModelNames(): Promise<string[]> {
        return this.runRepo.getAllModelNames();
    }

    // Feedback 相关方法
    async createFeedback(
        runId: string,
        feedbackData: FeedbackPayload
    ): Promise<FeedbackRecord> {
        return this.feedbackRepo.createFeedback(runId, feedbackData);
    }

    async getFeedbackByRunId(runId: string): Promise<FeedbackRecord[]> {
        return this.feedbackRepo.getFeedbackByRunId(runId);
    }

    // Attachment 相关方法
    async createAttachment(
        runId: string,
        filename: string,
        contentType: string,
        fileSize: number,
        storagePath: string
    ): Promise<AttachmentRecord> {
        return this.attachmentRepo.createAttachment(
            runId,
            filename,
            contentType,
            fileSize,
            storagePath
        );
    }

    async getAttachmentsByRunId(runId: string): Promise<AttachmentRecord[]> {
        return this.attachmentRepo.getAttachmentsByRunId(runId);
    }

    // Trace 相关方法
    async getAllTraces(): Promise<TraceOverview[]> {
        return this.traceRepo.getAllTraces();
    }

    async getTracesBySystem(system: string): Promise<TraceOverview[]> {
        return this.traceRepo.getTracesBySystem(system);
    }

    async getTracesByThreadId(threadId: string): Promise<TraceOverview[]> {
        return this.traceRepo.getTracesByThreadId(threadId);
    }

    async getTracesByUserId(userId: string): Promise<TraceOverview[]> {
        return this.traceRepo.getTracesByUserId(userId);
    }

    async getThreadOverviews(filters?: {
        system?: string;
        thread_id?: string;
    }): Promise<Array<TraceOverview>> {
        return this.traceRepo.getThreadOverviews(filters);
    }

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
        return this.traceRepo.getTracesByConditions(conditions, limit, offset);
    }

    async countTracesByConditions(conditions: {
        system?: string;
        thread_id?: string;
        user_id?: string;
        run_type?: string;
        model_name?: string;
    }): Promise<number> {
        return this.traceRepo.countTracesByConditions(conditions);
    }
}

// 导出相关类型和接口
export type { DatabaseAdapter, PreparedStatement } from "./interfaces.js";
export { BaseDatabase } from "./base-database.js";
export { SystemRepository } from "./repositories/system-repository.js";
export { RunRepository } from "./repositories/run-repository.js";
export { FeedbackRepository } from "./repositories/feedback-repository.js";
export { AttachmentRepository } from "./repositories/attachment-repository.js";
export { TraceRepository } from "./repositories/trace-repository.js";
export { RunStatsRepository } from "./repositories/run-stats-repository.js";
