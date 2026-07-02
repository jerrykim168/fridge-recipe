// Minimal ambient typings for Node's built-in `node:sqlite` module.
//
// Node 22.5+ ships `node:sqlite` (unflagged since 23.4 / 24.x, confirmed
// working on the Node version this project runs — see NOTES_FOR_REVIEW.md).
// @types/node in this project (20.x) predates the module, so we hand-declare
// only the surface area lib/db actually uses instead of bumping @types/node
// (avoids an unrelated, riskier dependency upgrade).
declare module "node:sqlite" {
  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  // Rows come back as plain (null-prototype) objects keyed by column name.
  export type SqliteRow = Record<string, unknown>;

  export class StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): SqliteRow | undefined;
    all(...params: unknown[]): SqliteRow[];
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
