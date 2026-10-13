# StockFlow — ERD

```mermaid
erDiagram
  USERS ||--o{ ORDERS : creates
  USERS ||--o{ STOCK_MOVEMENTS : records
  CATEGORIES ||--o{ PRODUCTS : groups
  CLIENTS ||--o{ ORDERS : places
  ORDERS ||--|{ ORDER_ITEMS : contains
  PRODUCTS ||--o{ ORDER_ITEMS : sold_as
  PRODUCTS ||--o{ STOCK_MOVEMENTS : changes

  USERS { bigint id PK string full_name string email UK string password_hash string role }
  CATEGORIES { bigint id PK string name UK datetime created_at }
  PRODUCTS { bigint id PK string name string sku UK decimal price bigint category_id FK int stock_quantity datetime created_at }
  CLIENTS { bigint id PK string full_name string phone string email datetime created_at }
  ORDERS { bigint id PK bigint client_id FK string status decimal total_amount bigint created_by FK datetime created_at }
  ORDER_ITEMS { bigint id PK bigint order_id FK bigint product_id FK int quantity decimal unit_price decimal subtotal }
  STOCK_MOVEMENTS { bigint id PK string type bigint product_id FK int quantity string reason bigint created_by FK datetime created_at }
```

`server/db/schema.sql` is the executable source of truth for types, checks, foreign keys, uniqueness and indexes. `order_items` enforces one row per product per order; adding the same product again increments its quantity.
