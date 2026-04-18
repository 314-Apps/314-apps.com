import "dotenv/config";
import { ensureTableExists } from "../src/lib/dynamo.js";

const table = process.env.TABLE_NAME?.trim();
if (!table) {
  console.error("TABLE_NAME is required");
  process.exit(1);
}

await ensureTableExists(table);
console.log("Table ready:", table);
