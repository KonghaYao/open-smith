declare module "bun:sqlite" {
    export interface Statement<ParamsType = any, ReturnType = any> {
        all(params?: ParamsType): ReturnType[];
        get(params?: ParamsType): ReturnType | undefined;
        run(params?: ParamsType): { lastInsertRowid: number; changes: number };
        values(params?: ParamsType): unknown[][];
        finalize(): void;
        toString(): string;
        columnNames: string[];
        paramsCount: number;
        native: any;
        as<T>(Class: new () => T): Statement<ParamsType, T>;
    }

    export interface DatabaseOptions {
        readonly?: boolean;
        create?: boolean;
        readwrite?: boolean;
        strict?: boolean;
        safeIntegers?: boolean;
    }

    export class Database {
        constructor(filename?: string, options?: DatabaseOptions);
        query<ParamsType = any, ReturnType = any>(
            sql: string,
        ): Statement<ParamsType, ReturnType>;
        prepare<ParamsType = any, ReturnType = any>(
            sql: string,
        ): Statement<ParamsType, ReturnType>;
        run(
            sql: string,
            params?: any,
        ): { lastInsertRowid: number; changes: number };
        exec(sql: string): void;
        transaction<T extends any[], R>(
            fn: (...args: T) => R,
        ): (...args: T) => R;
        serialize(): Uint8Array;
        close(throwOnError?: boolean): void;
        loadExtension(name: string): void;
        fileControl(cmd: number, value: any): void;
        static deserialize(contents: Uint8Array): Database;
        static setCustomSQLite(path: string): void;
    }

    export const constants: {
        SQLITE_FCNTL_PERSIST_WAL: number;
        [key: string]: number;
    };
}
