export interface MultipartFormDataEntry {
    name: string;
    value: string | File;
    filename?: string;
    contentType?: string;
}

export interface ParsedMultipartEntry {
    event: MultipartEvent;
    runId: string;
    field?: string;
    filename?: string;
    data: string | File;
}

export type MultipartEvent = "post" | "patch" | "feedback" | "attachment";

export interface RunPayload {
    id?: string;
    trace_id?: string;
    name?: string;
    run_type?: string;
    system?: string; // 系统标识，来自 x-api-key
    model_name?: string; // 模型名称, 来自 outputs.generations[0][0].generation_info.model_name
    thread_id?: string; // 线程ID，来自 extra.metadata.thread_id
    start_time?: string;
    end_time?: string;
    inputs?: any; // 可以是任何类型，例如对象
    outputs?: any; // 可以是任何类型，例如对象
    events?: any; // 可以是任何类型
    error?: any; // 可以是任何类型
    extra?: any; // 可以是任何类型
    serialized?: any; // 可以是任何类型
    total_tokens?: number; // 新增字段：总 token 数
}

export interface FeedbackPayload {
    trace_id: string; // 必需字段
    feedback_id?: string;
    score?: number;
    comment?: string;
    metadata?: any;
}

export interface MultipartConfig {
    multipart_patterns: {
        run_create: string;
        run_update: string;
        run_field: string;
        feedback: string;
        attachment: string;
    };
    supported_events: MultipartEvent[];
    out_of_band_fields: string[];
    field_types: {
        run_payload: string;
        feedback_payload: string;
        out_of_band_data: string;
        attachment: string;
    };
    validation_rules: {
        feedback_required_fields: string[];
        content_type_required: boolean;
        content_length_required: boolean;
        per_part_encoding_forbidden: boolean;
    };
    storage_config: {
        attachment_storage: string;
        compression_support: string[];
    };
    examples: {
        run_create: string;
        run_update: string;
        run_inputs: string;
        run_outputs: string;
        feedback: string;
        attachment: string;
    };
}

export interface MultipartParseResult {
    runs: {
        create: Map<string, RunPayload>;
        update: Map<string, RunPayload>;
        fields: Map<string, Map<string, any>>;
    };
    feedback: Map<string, FeedbackPayload>;
    attachments: Map<string, Map<string, File>>;
}

export class MultipartParser {
    private config: MultipartConfig;

    constructor(config: MultipartConfig) {
        this.config = config;
    }

    parsePartName(partName: string): ParsedMultipartEntry | null {
        const patterns = this.config.multipart_patterns;

        // 检查 run_create 模式
        let match = partName.match(patterns.run_create);
        if (match) {
            return {
                event: "post",
                runId: match[1],
                data: "",
            };
        }

        // 检查 run_update 模式
        match = partName.match(patterns.run_update);
        if (match) {
            return {
                event: "patch",
                runId: match[1],
                data: "",
            };
        }

        // 检查 run_field 模式
        match = partName.match(patterns.run_field);
        if (match) {
            return {
                event: match[1] as MultipartEvent,
                runId: match[2],
                field: match[3],
                data: "",
            };
        }

        // 检查 feedback 模式
        match = partName.match(patterns.feedback);
        if (match) {
            return {
                event: "feedback",
                runId: match[1],
                data: "",
            };
        }

        // 检查 attachment 模式
        match = partName.match(patterns.attachment);
        if (match) {
            return {
                event: "attachment",
                runId: match[1],
                filename: match[2],
                data: "",
            };
        }

        return null;
    }

    validateFeedback(feedback: FeedbackPayload): boolean {
        const requiredFields =
            this.config.validation_rules.feedback_required_fields;
        return requiredFields.every((field) => field in feedback);
    }
}
