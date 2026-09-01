import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const RECURRENCES = ["Única", "Diária", "Semanal", "Mensal"] as const;
const PRIORITIES = ["Baixa", "Média", "Alta"] as const;

const taskSchema = new Schema(
  {
    residenceId: { type: Schema.Types.ObjectId, ref: "Residence", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    recurrence: { type: String, enum: RECURRENCES, default: "Única" },
    priority: { type: String, enum: PRIORITIES, default: "Média" },
    done: { type: Boolean, default: false },
    lastCompletedAt: { type: Date, default: null },
    nextDueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

export type TaskDocument = HydratedDocument<InferSchemaType<typeof taskSchema>>;

export const TaskModel = model("Task", taskSchema);
