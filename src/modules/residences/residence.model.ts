import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const residenceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, trim: true },
    description: { type: String, trim: true },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    plan: { type: String, enum: ["free", "premium"], default: "free" },
  },
  { timestamps: true }
);

export type ResidenceDocument = HydratedDocument<InferSchemaType<typeof residenceSchema>>;

export const ResidenceModel = model("Residence", residenceSchema);
