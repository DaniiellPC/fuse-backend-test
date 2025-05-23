import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";

@Entity("portfolios")
@Unique(["user_id", "stock_symbol"])
export class Portfolio {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  user_id: string;

  @ManyToOne(() => User, (user) => user.portfolios, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 10 })
  stock_symbol: string;

  @Column("int")
  quantity: number;

  @Column({ type: "numeric", precision: 18, scale: 4, nullable: true })
  average_buy_price: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
