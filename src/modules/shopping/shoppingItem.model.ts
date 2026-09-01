import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const shoppingItemSchema = new Schema(
  {
    residenceId: { type: Schema.Types.ObjectId, ref: "Residence", required: true, index: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: String, trim: true, default: "" },
    addedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purchased: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type ShoppingItemDocument = HydratedDocument<InferSchemaType<typeof shoppingItemSchema>>;

export const ShoppingItemModel = model("ShoppingItem", shoppingItemSchema);
