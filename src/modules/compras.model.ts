import mongoose, {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument,
  type Model,
} from "mongoose";

const compraSchema = new Schema(
  {
    nome: { type: String, required: true },
    quantidade: { type: Number, required: true },
    solicitante: { type: String, required: true },
    isComprado: { type: Boolean, default: false },
    dataSolicitacao: { type: Date, default: Date.now },
    residenceId: { type: String, default: null },
  },
  { timestamps: true },
);

export type CompraDocument = HydratedDocument<
  InferSchemaType<typeof compraSchema>
>;

export const CompraModel: Model<InferSchemaType<typeof compraSchema>> =
  (mongoose.models?.Compra as Model<InferSchemaType<typeof compraSchema>>) ||
  model("Compra", compraSchema);
