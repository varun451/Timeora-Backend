import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(env.MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export const disconnectDB = () => mongoose.disconnect();
