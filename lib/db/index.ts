import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { requiredEnv } from "../env";

const pool = new Pool({
  connectionString: requiredEnv("DATABASE_URL"),
});

export const db = drizzle(pool, { schema });
