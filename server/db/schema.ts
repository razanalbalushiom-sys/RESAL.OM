import { pgTable, serial, text, integer, real, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password: text('password'),
  role: text('role').default('user'),
  created_at: timestamp('created_at').defaultNow()
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  cat: text('cat'),
  emoji: text('emoji'),
  price: real('price').default(0),
  oldPrice: real('oldPrice'),
  badge: text('badge'),
  badgeType: text('badgeType'),
  rating: real('rating').default(5.0),
  reviews: integer('reviews').default(0),
  desc: text('desc'),
  images: text('images').default('[]'),
  created_at: timestamp('created_at').defaultNow()
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  order_id: text('order_id'),
  customer_name: text('customer_name'),
  wilayat: text('wilayat'),
  area: text('area'),
  phone: text('phone'),
  items: text('items'),
  delivery: text('delivery'),
  deliveryCost: real('deliveryCost').default(0),
  total: real('total').default(0),
  status: text('status').default('new'),
  payment: text('payment'),
  proof: text('proof'),
  created_at: timestamp('created_at').defaultNow()
});
