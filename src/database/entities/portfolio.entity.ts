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

export type PortfolioProperties = {
  id: string;
  user_id: string;
  stock_symbol: string;
  quantity: number;
  average_buy_price?: number;
  created_at: Date;
  updated_at?: Date;
};

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

  getPortfolioProperties(): PortfolioProperties {
    return {
      id: this.id,
      user_id: this.user_id,
      stock_symbol: this.stock_symbol,
      quantity: this.quantity,
      average_buy_price: this.average_buy_price,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
