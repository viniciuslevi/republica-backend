import { ShoppingItemModel } from "./shopping.model.js";
import type { CreateShoppingItemInput } from "./shopping.schema.js";
import { NotFoundError } from "../../shared/errors/AppError.js";

export const shoppingService = {
  async list(residenceId: string) {
    return ShoppingItemModel.find({ residenceId }).sort({ createdAt: -1 });
  },

  async create(residenceId: string, addedById: string, input: CreateShoppingItemInput) {
    return ShoppingItemModel.create({
      residenceId,
      name: input.name,
      quantity: input.quantity,
      addedById,
    });
  },

  async setPurchased(residenceId: string, itemId: string, purchased: boolean) {
    const item = await ShoppingItemModel.findOneAndUpdate(
      { _id: itemId, residenceId },
      { purchased },
      { new: true }
    );
    if (!item) {
      throw new NotFoundError("Item não encontrado");
    }
    return item;
  },

  async remove(residenceId: string, itemId: string) {
    const item = await ShoppingItemModel.findOneAndDelete({ _id: itemId, residenceId });
    if (!item) {
      throw new NotFoundError("Item não encontrado");
    }
  },
};
