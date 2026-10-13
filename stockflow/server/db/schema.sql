CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, full_name VARCHAR(120) NOT NULL, email VARCHAR(180) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role VARCHAR(10) NOT NULL CHECK (role IN ('admin','staff')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS categories (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(180) NOT NULL, sku VARCHAR(80) NOT NULL UNIQUE,
 price NUMERIC(12,2) NOT NULL CHECK (price >= 0), category_id BIGINT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS clients (
 id BIGSERIAL PRIMARY KEY, full_name VARCHAR(180) NOT NULL, phone VARCHAR(40) NOT NULL, email VARCHAR(180), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS orders (
 id BIGSERIAL PRIMARY KEY, client_id BIGINT NOT NULL REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 status VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','cancelled','delivered')),
 total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0), created_by BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_items (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id BIGINT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0), UNIQUE(order_id, product_id)
);
CREATE TABLE IF NOT EXISTS stock_movements (
 id BIGSERIAL PRIMARY KEY, type VARCHAR(3) NOT NULL CHECK (type IN ('IN','OUT')),
 product_id BIGINT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 quantity INTEGER NOT NULL CHECK (quantity > 0), reason VARCHAR(240) NOT NULL,
 created_by BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(full_name);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_product_created ON stock_movements(product_id, created_at DESC);
