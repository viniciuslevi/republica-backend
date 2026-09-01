import { ShoppingItemModel } from "./shoppingItem.model.js";
import type { CreateShoppingItemInput, UpdateShoppingItemInput } from "./shopping.schema.js";
import { NotFoundError } from "../../shared/errors/AppError.js";

export const shoppingService = {
  async list(residenceId: string) {
    return ShoppingItemModel.find({ residenceId }).sort({ createdAt: -1 });
  },

  async create(residenceId: string, userId: string, input: CreateShoppingItemInput) {
    return ShoppingItemModel.create({
      residenceId,
      name: input.name,
      quantity: input.quantity ?? "",
      addedById: userId,
    });
  },

  async update(residenceId: string, itemId: string, input: UpdateShoppingItemInput) {
    const item = await ShoppingItemModel.findOneAndUpdate({ _id: itemId, residenceId }, input, { new: true });
    if (!item) {
      throw new NotFoundError("Item não encontrado");
    }
    return item;
  },

  async remove(residenceId: string, itemId: string) {
    const result = await ShoppingItemModel.deleteOne({ _id: itemId, residenceId });
    if (result.deletedCount === 0) {
      throw new NotFoundError("Item não encontrado");
    }
  },
};
