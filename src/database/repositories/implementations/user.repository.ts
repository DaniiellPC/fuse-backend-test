// src/database/repositories/implementations/user.repository.ts
import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, Repository } from "typeorm";
import { User } from "../../entities/user.entity";
import { IUserRepository } from "../interfaces/user-repository.interface";

@Injectable()
export class UserRepository implements IUserRepository {
  private readonly userRepo: Repository<User>;

  constructor(private readonly dataSource: DataSource) {
    this.userRepo = this.dataSource.getRepository(User);
  }

  async findOneByIdWithLock(
    userId: string,
    manager?: EntityManager
  ): Promise<User | null> {
    const repository = manager ? manager.getRepository(User) : this.userRepo;
    return repository.findOne({
      where: { id: userId },
      lock: { mode: "optimistic", version: new Date() }, // Bloqueo para actualizaciones
    });
  }

  async findOneById(
    userId: string,
    manager?: EntityManager
  ): Promise<User | null> {
    const repository = manager ? manager.getRepository(User) : this.userRepo;
    return repository.findOne({ where: { id: userId } });
  }

  async save(user: User, manager?: EntityManager): Promise<User> {
    const repository = manager ? manager.getRepository(User) : this.userRepo;
    return repository.save(user);
  }
}
