import { afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri();

afterAll(async () => {
  await mongod.stop();
});
