import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const expenseSchema = new Schema(
  {
    residenceId: { type: Schema.Types.ObjectId, ref: "Residence", required: true, index: true },
    description: { type: String, required: true, trim: true },
    value: { type: Number, required: true, min: 0 },
    payerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participantIds: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  },
  { timestamps: true }
);

export type ExpenseDocument = HydratedDocument<InferSchemaType<typeof expenseSchema>>;

export const ExpenseModel = model("Expense", expenseSchema);
