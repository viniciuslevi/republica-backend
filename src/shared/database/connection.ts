import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(uri: string = env.MONGODB_URI) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
