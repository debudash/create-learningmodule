import { connect, type Database } from '@lcg/db';

// One pool per server process, surviving Next.js hot reloads in development.
const holder = globalThis as unknown as { lcgDatabase?: Database };

export const db: Database = (holder.lcgDatabase ??= connect().db);
