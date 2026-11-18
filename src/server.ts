import app from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { env } from "./config/env.js";

try {
  await connectDB();
} catch (e) {
  console.error("Could not connect to MongoDB. Is it running, and is MONGODB_URI correct?");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

const server = app.listen(env.PORT, () => console.log(`Timeora API running on http://localhost:${env.PORT}/api`));

const shutdown = () => server.close(async () => { await disconnectDB(); process.exit(0); });
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
