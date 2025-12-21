import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { config } from '../config/index.js';

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
    connectionString: config.database.url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Create drizzle instance
export const db = drizzle(pool, { schema });

// Export pool for raw queries if needed
export { pool };

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        return false;
    }
}
