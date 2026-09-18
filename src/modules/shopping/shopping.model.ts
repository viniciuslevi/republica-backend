import mongoose, { Schema, model, type InferSchemaType, type HydratedDocument, type Model } from "mongoose";

const shoppingItemSchema = new Schema(
  {
    residenceId: { type: Schema.Types.ObjectId, ref: "Residence", required: true, index: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: String, trim: true },
    addedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purchased: { type: Boolean, default: false },
  },
  { timestamps: true }
);

shoppingItemSchema.index({ residenceId: 1, createdAt: -1 });

export type ShoppingItemDocument = HydratedDocument<InferSchemaType<typeof shoppingItemSchema>>;

export const ShoppingItemModel: Model<InferSchemaType<typeof shoppingItemSchema>> =
  (mongoose.models?.ShoppingItem as Model<InferSchemaType<typeof shoppingItemSchema>>) ||
  model("ShoppingItem", shoppingItemSchema);
