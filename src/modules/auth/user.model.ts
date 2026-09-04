import mongoose, { Schema, model, type InferSchemaType, type HydratedDocument, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
  },
  { timestamps: true }
);

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const UserModel: Model<InferSchemaType<typeof userSchema>> =
  (mongoose.models?.User as Model<InferSchemaType<typeof userSchema>>) || model("User", userSchema);
