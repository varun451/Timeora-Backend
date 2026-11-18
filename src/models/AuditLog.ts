import mongoose, { type Types } from "mongoose";
const { Schema, model, models } = mongoose;

const schema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorRole: { type: String, enum: ["customer", "seller", "super_admin", "admin", "system"], default: "system" },
    action: { type: String, required: true, index: true },
    target: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, index: true },
    details: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actor?: Types.ObjectId;
  actorRole: string;
  action: string;
  target: string;
  targetId?: Types.ObjectId;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

export const AuditLogModel = models.AuditLog ?? model("AuditLog", schema);

