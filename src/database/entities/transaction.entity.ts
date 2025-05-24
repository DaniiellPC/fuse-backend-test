import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

export enum TransactionType {
  BUY = "BUY",
  SELL = "SELL",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  user_id: string;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 10 })
  stock_symbol: string;

  @Column({ type: "enum", enum: TransactionType })
  transaction_type: TransactionType;

  @Column("int")
  quantity: number;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  price_at_transaction: number;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  total_amount: number;

  @Column({
    type: "enum",
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({
    type: "timestamp with time zone",
    default: () => "CURRENT_TIMESTAMP",
  })
  transaction_date: Date;

  @Column({ type: "timestamp with time zone", nullable: true })
  completion_date: Date;

  @Column({ type: "varchar", length: 500, nullable: true })
  message: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  constructor(
    user_id: string,
    stock_symbol: string,
    transaction_type: TransactionType,
    quantity: number,
    price_at_transaction: number,
    total_amount: number,
    status: TransactionStatus,
    transaction_date: Date,
    created_at: Date,
    completion_date?: Date,
    message?: string,
    updated_at?: Date
  ) {
    this.user_id = user_id;
    this.stock_symbol = stock_symbol;
    this.transaction_type = transaction_type;
    this.quantity = quantity;
    this.price_at_transaction = price_at_transaction;
    this.total_amount = total_amount;
    this.status = status;
    this.transaction_date = transaction_date;
    this.created_at = created_at;
    this.completion_date = completion_date || null;
    this.message = message || null;
    this.updated_at = updated_at;
  }

  static create({
    user_id,
    stock_symbol,
    transaction_type,
    quantity,
    price_at_transaction,
    total_amount,
    status,
    created_at,
    transaction_date,
    completion_date,
    message,
    updated_at,
  }: {
    user_id: string;
    stock_symbol: string;
    transaction_type: TransactionType;
    quantity: number;
    price_at_transaction: number;
    total_amount: number;
    status: TransactionStatus;
    created_at: Date;
    transaction_date?: Date;
    completion_date?: Date;
    message?: string;
    updated_at?: Date;
  }): Transaction {
    return new Transaction(
      user_id,
      stock_symbol,
      transaction_type,
      quantity,
      price_at_transaction,
      total_amount,
      status,
      created_at,
      transaction_date || new Date(),
      completion_date || null,
      message,
      updated_at || new Date()
    );
  }

  updateStatus(status: TransactionStatus) {
    this.status = status;
    this.transaction_date = new Date();
    this.completion_date =
      status === TransactionStatus.COMPLETED ? new Date() : null;
    this.updated_at = new Date();
  }

  setMessage(message: string) {
    this.message = message;
    this.updated_at = new Date();
  }

  getMessage(): string {
    return this.message || "No message provided";
  }

  getStatus(): TransactionStatus {
    return this.status;
  }

  getUserId(): string {
    return this.user_id;
  }
}
