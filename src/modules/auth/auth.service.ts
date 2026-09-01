import bcrypt from "bcryptjs";
import { UserModel } from "./user.model.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import { ConflictError, UnauthorizedError } from "../../shared/errors/AppError.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../shared/security/tokens.js";

const SALT_ROUNDS = 10;

function toAuthUser(user: { id: string; name: string; email: string; phone?: string | null }) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone ?? undefined };
}

function issueTokens(user: { id: string; email: string }) {
  const payload = { sub: user.id, email: user.email };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await UserModel.findOne({ email: input.email });
    if (existing) {
      throw new ConflictError("Este e-mail já está cadastrado. Faça login ou use outro e-mail.");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone,
    });

    return {
      user: toAuthUser({ id: user.id, name: user.name, email: user.email, phone: user.phone }),
      ...issueTokens({ id: user.id, email: user.email }),
    };
  },

  async login(input: LoginInput) {
    const user = await UserModel.findOne({ email: input.email });
    if (!user) {
      throw new UnauthorizedError("E-mail ou senha inválidos");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError("E-mail ou senha inválidos");
    }

    return {
      user: toAuthUser({ id: user.id, name: user.name, email: user.email, phone: user.phone }),
      ...issueTokens({ id: user.id, email: user.email }),
    };
  },

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError("Refresh token inválido ou expirado");
    }

    const user = await UserModel.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError("Usuário não encontrado");
    }

    return issueTokens({ id: user.id, email: user.email });
  },
};
