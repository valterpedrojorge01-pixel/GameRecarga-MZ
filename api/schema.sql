-- GameRecarga MZ — Cloudflare D1 schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  pack TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'MZN',
  player_id TEXT NOT NULL,
  contact TEXT,
  payment_method TEXT,
  payment_id TEXT,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'Pagamento pendente',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT NOT NULL DEFAULT 'waiting_payment',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'NetShop',
  provider_payment_id TEXT,
  reference TEXT,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MZN',
  raw_event TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
