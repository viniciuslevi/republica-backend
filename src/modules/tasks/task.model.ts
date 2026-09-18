import mongoose, { Schema, model, type InferSchemaType, type HydratedDocument, type Model } from "mongoose";

const RECURRENCES = ["Única", "Diária", "Semanal", "Mensal"] as const;
const PRIORITIES = ["Baixa", "Média", "Alta"] as const;
export const TASK_STATUSES = ["A fazer", "Em andamento", "Feito", "Cancelada"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const taskSchema = new Schema(
  {
    residenceId: { type: Schema.Types.ObjectId, ref: "Residence", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    recurrence: { type: String, enum: RECURRENCES, default: "Única" },
    priority: { type: String, enum: PRIORITIES, default: "Média" },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: function (this: any) {
        return this?.done ? "Feito" : "A fazer";
      },
    },
    done: { type: Boolean, default: false },
    lastCompletedAt: { type: Date, default: null },
    nextDueDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    dueTime: { type: String, trim: true, default: null },
    weekDay: { type: Number, min: 0, max: 6, default: null },
    monthDay: { type: Number, min: 1, max: 31, default: null },
  },
  { timestamps: true }
);

export type TaskDocument = HydratedDocument<InferSchemaType<typeof taskSchema>>;

export const TaskModel: Model<InferSchemaType<typeof taskSchema>> =
  (mongoose.models?.Task as Model<InferSchemaType<typeof taskSchema>>) || model("Task", taskSchema);
