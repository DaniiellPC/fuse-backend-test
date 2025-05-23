import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Transaction } from "./transaction.entity"; // Importa la entidad de transacción
import { Portfolio } from "./portfolio.entity"; // Importa la entidad de portafolio

@Entity("users") // Nombre de la tabla en la BD
export class User {
  @PrimaryGeneratedColumn("uuid") // Genera UUIDs automáticamente
  id: string;

  @Column({ type: "varchar", length: 50, unique: true })
  username: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255 })
  password_hash: string;

  @Column({ type: "numeric", precision: 18, scale: 4, default: 0.0 })
  balance: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];

  @OneToMany(() => Portfolio, (portfolio) => portfolio.user)
  portfolios: Portfolio[];
}
