import { User } from "../../entities/user.entity";
import { EntityManager } from "typeorm";

export const USER_REPOSITORY_TOKEN = "IUserRepository";

export interface IUserRepository {
  findOneByIdWithLock(
    userId: string,
    manager?: EntityManager
  ): Promise<User | null>;
  findOneById(userId: string, manager?: EntityManager): Promise<User | null>;
  save(user: User, manager?: EntityManager): Promise<User>;
}
