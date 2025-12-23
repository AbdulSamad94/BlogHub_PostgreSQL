import "server-only";
import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/lib/db/schema/schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });