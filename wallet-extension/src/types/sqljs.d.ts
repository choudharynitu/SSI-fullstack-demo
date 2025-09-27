declare module 'sql.js' {
  // Minimal Statement surface (enough for typical use)
  export interface Statement {
    bind(params?: any): boolean
    run(params?: any): Statement
    step(): boolean
    getAsObject(params?: any): any
    free(): void
  }

  export interface Database {
    // ✅ allow params as 2nd arg
    run(sql: string, params?: any): Database
    exec(sql: string, params?: any): any
    prepare(sql: string, params?: any): Statement
    export(): Uint8Array
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }

  const initSqlJs: (config?: InitSqlJsConfig) => Promise<SqlJsStatic>
  export default initSqlJs
  export type { Database, Statement }
}


/*declare module 'sql.js' {
  export interface Database {
    run(sql: string): void
    exec(sql: string): any
    prepare(sql: string): any
    export(): Uint8Array
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>
  export type { Database }
}*/
