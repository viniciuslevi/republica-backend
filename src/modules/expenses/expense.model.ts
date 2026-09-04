import mongoose, { Schema, model, type InferSchemaType, type HydratedDocument, type Model } from "mongoose";

const expenseSchema = new Schema(
  {
    residenceId: { type: Schema.Types.ObjectId, ref: "Residence", required: true, index: true },
    description: { type: String, required: true, trim: true },
    value: { type: Number, required: true, min: 0.01 },
    payerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participantIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

expenseSchema.index({ residenceId: 1, createdAt: -1 });

export type ExpenseDocument = HydratedDocument<InferSchemaType<typeof expenseSchema>>;

export const ExpenseModel: Model<InferSchemaType<typeof expenseSchema>> =
  (mongoose.models?.Expense as Model<InferSchemaType<typeof expenseSchema>>) || model("Expense", expenseSchema);
