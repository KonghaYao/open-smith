// 数据库适配器接口
export interface DatabaseAdapter {
    exec(sql: string): Promise<void>;
    prepare(sql: string): Promise<PreparedStatement>;
    transaction<T extends any[], R>(
        fn: (...args: T) => Promise<R>
    ): Promise<(...args: T) => Promise<R>>;
    close(): Promise<void>;
    getStringAggregateFunction(
        column: string,
        distinct: boolean,
        delimiter: string
    ): string;
    getPlaceholder(index: number): string;
}

// 预处理语句接口
export interface PreparedStatement {
    run(params?: any[]): Promise<{ changes: number }>;
    get(params?: any): Promise<any>;
    all(params?: any): Promise<any[]>;
}
