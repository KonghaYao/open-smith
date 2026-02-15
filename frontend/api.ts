import { ofetch } from "ofetch";

export const fetch = ofetch.create({
    baseURL: process.env.NODE_ENV === "development" ? "/api" : "../",
});
export { fetch as ofetch };

// ========================================
// Analytics API Types
// ========================================

export interface TimeseriesQuery {
    dimension?: "system" | "model_name" | "run_type" | "user_id";
    metrics: string[];
    granularity: "5min" | "15min" | "30min" | "1h" | "1d" | "1w" | "1m";
    start_time?: string;
    end_time?: string;
    filters?: {
        system?: string[];
        model_name?: string[];
        run_type?: string[];
        user_id?: string;
    };
    limit?: number;
    offset?: number;
}

export interface TimeseriesResponse {
    success: boolean;
    data: Array<{
        time: string;
        dimensions?: Record<string, string>;
        metrics: Record<string, number | null>;
    }>;
    meta: {
        total: number;
        limit: number;
        offset: number;
    };
}

export interface TrendQuery {
    metric: "total_runs" | "successful_runs" | "failed_runs" | "error_rate" |
            "avg_duration_ms" | "p95_duration_ms" | "p99_duration_ms" |
            "total_tokens_sum" | "avg_tokens_per_run" | "avg_ttft_ms" | "distinct_users";
    period: "dod" | "wow" | "mom";
    start_time?: string;
    end_time?: string;
    filters?: Record<string, any>;
}

export interface TrendResponse {
    success: boolean;
    data: {
        current: {
            value: number;
            period: string;
        };
        previous: {
            value: number;
            period: string;
        };
        trend: {
            value: number;
            percentage: number;
            direction: "up" | "down";
        };
    };
}

export interface CompareQuery {
    compare_by: "model" | "system" | "time_period";
    metrics: string[];
    start_time_1: string;
    end_time_1: string;
    start_time_2?: string;
    end_time_2?: string;
    filters?: Record<string, any>;
}

export interface CompareResponse {
    success: boolean;
    data: Array<{
        dimension: Record<string, string>;
        period_1: Record<string, number>;
        period_2: Record<string, number>;
        diff: Record<string, number>;
    }>;
}

export interface AnomalyQuery {
    metric: "avg_duration_ms" | "p95_duration_ms" | "p99_duration_ms" |
            "avg_tokens_per_run" | "avg_ttft_ms";
    start_time: string;
    end_time: string;
    threshold?: number;
    filters?: Record<string, any>;
}

export interface AnomalyResponse {
    success: boolean;
    data: {
        metric: string;
        baseline: {
            mean: number;
            stddev: number;
            upper_threshold: number;
            lower_threshold: number;
        };
        anomalies: Array<{
            time: string;
            value: number;
            z_score: number;
            severity: "high" | "medium" | "low";
        }>;
    };
}

export interface SummaryQuery {
    start_time?: string;
    end_time?: string;
    filters?: Record<string, any>;
}

export interface SummaryResponse {
    success: boolean;
    data: {
        runs: {
            total: number;
            successful: number;
            failed: number;
            success_rate: number;
        };
        performance: {
            avg_duration_ms: number;
            p95_duration_ms: number;
            p99_duration_ms: number;
            avg_ttft_ms: number;
        };
        tokens: {
            total: number;
            avg_per_run: number;
        };
        users: {
            distinct: number;
        };
        top_models: Array<{
            model_name: string;
            runs: number;
            avg_duration_ms: number;
        }>;
    };
}

// ========================================
// Analytics API Functions
// ========================================

const analyticsBaseUrl = "/api/v1/analytics";

export async function getTimeseries(query: TimeseriesQuery): Promise<TimeseriesResponse> {
    const params = new URLSearchParams();

    // Only add dimension if it has a truthy value (avoid undefined being converted to string)
    if (query.dimension) {
        params.append("dimension", query.dimension);
    }
    params.append("metrics", query.metrics.join(","));
    params.append("granularity", query.granularity);
    if (query.start_time) params.append("start_time", query.start_time);
    if (query.end_time) params.append("end_time", query.end_time);
    if (query.filters) params.append("filters", JSON.stringify(query.filters));
    if (query.limit) params.append("limit", query.limit.toString());
    if (query.offset) params.append("offset", query.offset.toString());

    const url = `${analyticsBaseUrl}/timeseries?${params.toString()}`;
    return fetch(url);
}

export async function getTrends(query: TrendQuery): Promise<TrendResponse> {
    const params = new URLSearchParams();

    params.append("metric", query.metric);
    params.append("period", query.period);
    if (query.start_time) params.append("start_time", query.start_time);
    if (query.end_time) params.append("end_time", query.end_time);
    if (query.filters) params.append("filters", JSON.stringify(query.filters));

    const url = `${analyticsBaseUrl}/trends?${params.toString()}`;
    return fetch(url);
}

export async function getComparison(query: CompareQuery): Promise<CompareResponse> {
    const params = new URLSearchParams();

    params.append("compare_by", query.compare_by);
    params.append("metrics", query.metrics.join(","));
    params.append("start_time_1", query.start_time_1);
    params.append("end_time_1", query.end_time_1);
    if (query.start_time_2) params.append("start_time_2", query.start_time_2);
    if (query.end_time_2) params.append("end_time_2", query.end_time_2);
    if (query.filters) params.append("filters", JSON.stringify(query.filters));

    const url = `${analyticsBaseUrl}/compare?${params.toString()}`;
    return fetch(url);
}

export async function getAnomalies(query: AnomalyQuery): Promise<AnomalyResponse> {
    const params = new URLSearchParams();

    params.append("metric", query.metric);
    params.append("start_time", query.start_time);
    params.append("end_time", query.end_time);
    if (query.threshold) params.append("threshold", query.threshold.toString());
    if (query.filters) params.append("filters", JSON.stringify(query.filters));

    const url = `${analyticsBaseUrl}/anomalies?${params.toString()}`;
    return fetch(url);
}

export async function getSummary(query: SummaryQuery = {}): Promise<SummaryResponse> {
    const params = new URLSearchParams();

    if (query.start_time) params.append("start_time", query.start_time);
    if (query.end_time) params.append("end_time", query.end_time);
    if (query.filters) params.append("filters", JSON.stringify(query.filters));

    const url = `${analyticsBaseUrl}/summary?${params.toString()}`;
    return fetch(url);
}
