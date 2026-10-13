import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { pool } from "../db.js";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { asyncHandler, httpError } from "../utils.js";

const router = Router();
const wrap = asyncHandler;
const idSchema = z.coerce.number().int().positive();
const nameSchema = z.string().trim().min(1).max(180);

const productSchema = z.object({
  name: nameSchema,
  sku: z.string().trim().min(1).max(80),
  price: z.coerce.number().min(0),
  categoryId: z.coerce.number().int().positive(),
});

const clientSchema = z.object({
  fullName: nameSchema,
  phone: z.string().trim().min(3).max(40),
  email: z
    .union([z.string().email().max(180), z.literal("")])
    .optional()
    .transform((value) => value || null),
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const message = "Données invalides.";

/* Authentification */

router.post(
  "/auth/login",
  wrap(async (req, res) => {
    const input = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .safeParse(req.body);

    if (!input.success) {
      throw httpError(400, message);
    }

    const { rows } = await pool.query(
      `SELECT id, full_name, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [input.data.email.toLowerCase()],
    );

    const user = rows[0];

    if (
      !user ||
      !(await bcrypt.compare(input.data.password, user.password_hash))
    ) {
      throw httpError(401, "Email ou mot de passe incorrect.");
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        name: user.full_name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  }),
);

router.get(
  "/auth/me",
  authenticate,
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, role
       FROM users
       WHERE id = $1`,
      [req.user.id],
    );

    if (!rows[0]) {
      throw httpError(401, "Utilisateur introuvable.");
    }

    const user = rows[0];

    res.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    });
  }),
);

router.use(authenticate);

/* Catégories */

router.get(
  "/categories",
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, created_at AS "createdAt"
       FROM categories
       ORDER BY name`,
    );

    res.json(rows);
  }),
);

router.post(
  "/categories",
  allowRoles("admin"),
  wrap(async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const { rows } = await pool.query(
      `INSERT INTO categories (name)
       VALUES ($1)
       RETURNING id, name, created_at AS "createdAt"`,
      [parsed.data.name],
    );

    res.status(201).json(rows[0]);
  }),
);

router.put(
  "/categories/:id",
  allowRoles("admin"),
  wrap(async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const { rows } = await pool.query(
      `UPDATE categories
       SET name = $1
       WHERE id = $2
       RETURNING id, name, created_at AS "createdAt"`,
      [parsed.data.name, idSchema.parse(req.params.id)],
    );

    if (!rows[0]) {
      throw httpError(404, "Catégorie introuvable.");
    }

    res.json(rows[0]);
  }),
);

router.delete(
  "/categories/:id",
  allowRoles("admin"),
  wrap(async (req, res) => {
    const result = await pool.query(
      "DELETE FROM categories WHERE id = $1",
      [idSchema.parse(req.params.id)],
    );

    if (!result.rowCount) {
      throw httpError(404, "Catégorie introuvable.");
    }

    res.status(204).end();
  }),
);

/* Produits : recherche et pagination */

router.get(
  "/products",
  wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10),
    );
    const search = `%${String(req.query.search || "").trim()}%`;

    const base = `
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE (
        $1 = '%%'
        OR p.name ILIKE $1
        OR p.sku ILIKE $1
      )
    `;

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total ${base}`,
      [search],
    );

    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.sku,
         p.price,
         p.category_id AS "categoryId",
         c.name AS "categoryName",
         p.stock_quantity AS "stockQuantity",
         p.created_at AS "createdAt"
       ${base}
       ORDER BY p.created_at DESC
       LIMIT $2
       OFFSET $3`,
      [search, limit, (page - 1) * limit],
    );

    const total = count.rows[0].total;

    res.json({
      items: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

router.get(
  "/products/:id",
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.sku,
         p.price,
         p.category_id AS "categoryId",
         c.name AS "categoryName",
         p.stock_quantity AS "stockQuantity",
         p.created_at AS "createdAt"
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [idSchema.parse(req.params.id)],
    );

    if (!rows[0]) {
      throw httpError(404, "Produit introuvable.");
    }

    res.json(rows[0]);
  }),
);

router.post(
  "/products",
  allowRoles("admin", "staff"),
  wrap(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const data = parsed.data;

    const { rows } = await pool.query(
      `INSERT INTO products (name, sku, price, category_id)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         name,
         sku,
         price,
         category_id AS "categoryId",
         stock_quantity AS "stockQuantity",
         created_at AS "createdAt"`,
      [data.name, data.sku, data.price, data.categoryId],
    );

    res.status(201).json(rows[0]);
  }),
);

router.put(
  "/products/:id",
  allowRoles("admin", "staff"),
  wrap(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const data = parsed.data;

    const { rows } = await pool.query(
      `UPDATE products
       SET name = $1, sku = $2, price = $3, category_id = $4
       WHERE id = $5
       RETURNING
         id,
         name,
         sku,
         price,
         category_id AS "categoryId",
         stock_quantity AS "stockQuantity",
         created_at AS "createdAt"`,
      [
        data.name,
        data.sku,
        data.price,
        data.categoryId,
        idSchema.parse(req.params.id),
      ],
    );

    if (!rows[0]) {
      throw httpError(404, "Produit introuvable.");
    }

    res.json(rows[0]);
  }),
);

router.delete(
  "/products/:id",
  allowRoles("admin"),
  wrap(async (req, res) => {
    const result = await pool.query(
      "DELETE FROM products WHERE id = $1",
      [idSchema.parse(req.params.id)],
    );

    if (!result.rowCount) {
      throw httpError(404, "Produit introuvable.");
    }

    res.status(204).end();
  }),
);

/* Clients */

router.get(
  "/clients",
  wrap(async (req, res) => {
    const search = `%${String(req.query.search || "").trim()}%`;

    const { rows } = await pool.query(
      `SELECT
         id,
         full_name AS "fullName",
         phone,
         email,
         created_at AS "createdAt"
       FROM clients
       WHERE (
         $1 = '%%'
         OR full_name ILIKE $1
         OR phone ILIKE $1
       )
       ORDER BY created_at DESC`,
      [search],
    );

    res.json(rows);
  }),
);

router.post(
  "/clients",
  allowRoles("admin", "staff"),
  wrap(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const data = parsed.data;

    const { rows } = await pool.query(
      `INSERT INTO clients (full_name, phone, email)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         full_name AS "fullName",
         phone,
         email,
         created_at AS "createdAt"`,
      [data.fullName, data.phone, data.email],
    );

    res.status(201).json(rows[0]);
  }),
);

router.put(
  "/clients/:id",
  allowRoles("admin", "staff"),
  wrap(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const data = parsed.data;

    const { rows } = await pool.query(
      `UPDATE clients
       SET full_name = $1, phone = $2, email = $3
       WHERE id = $4
       RETURNING
         id,
         full_name AS "fullName",
         phone,
         email,
         created_at AS "createdAt"`,
      [
        data.fullName,
        data.phone,
        data.email,
        idSchema.parse(req.params.id),
      ],
    );

    if (!rows[0]) {
      throw httpError(404, "Client introuvable.");
    }

    res.json(rows[0]);
  }),
);

router.delete(
  "/clients/:id",
  allowRoles("admin"),
  wrap(async (req, res) => {
    const result = await pool.query(
      "DELETE FROM clients WHERE id = $1",
      [idSchema.parse(req.params.id)],
    );

    if (!result.rowCount) {
      throw httpError(404, "Client introuvable.");
    }

    res.status(204).end();
  }),
);

/* Commandes */

router.get(
  "/orders",
  wrap(async (req, res) => {
    const status = req.query.status || null;
    const date = req.query.date || null;

    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.client_id AS "clientId",
         c.full_name AS "clientName",
         o.status,
         o.total_amount AS "totalAmount",
         o.created_at AS "createdAt",
         u.full_name AS "createdBy",
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'productId', oi.product_id,
               'productName', p.name,
               'sku', p.sku,
               'quantity', oi.quantity,
               'unitPrice', oi.unit_price,
               'subtotal', oi.subtotal
             )
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items
       FROM orders o
       JOIN clients c ON c.id = o.client_id
       JOIN users u ON u.id = o.created_by
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE ($1::text IS NULL OR o.status = $1)
         AND ($2::date IS NULL OR o.created_at::date = $2::date)
       GROUP BY o.id, c.full_name, u.full_name
       ORDER BY o.created_at DESC`,
      [status, date],
    );

    res.json(rows);
  }),
);

router.post(
  "/orders",
  allowRoles("admin", "staff"),
  wrap(async (req, res) => {
    const parsed = z
      .object({
        clientId: z.coerce.number().int().positive(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const { rows } = await pool.query(
      `INSERT INTO orders (client_id, created_by)
       VALUES ($1, $2)
       RETURNING
         id,
         client_id AS "clientId",
         status,
         total_amount AS "totalAmount",
         created_at AS "createdAt"`,
      [parsed.data.clientId, req.user.id],
    );

    res.status(201).json(rows[0]);
  }),
);

router.post(
  "/orders/:id/items",
  allowRoles("admin", "staff"),
  wrap(async (req, res) => {
    const parsed = z
      .object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const connection = await pool.connect();

    try {
      await connection.query("BEGIN");

      const orderId = idSchema.parse(req.params.id);
      const order = (
        await connection.query(
          "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
          [orderId],
        )
      ).rows[0];

      if (!order) {
        throw httpError(404, "Commande introuvable.");
      }

      if (order.status !== "draft") {
        throw httpError(
          409,
          "Seule une commande en brouillon peut être modifiée.",
        );
      }

      const product = (
        await connection.query(
          "SELECT id, price FROM products WHERE id = $1",
          [parsed.data.productId],
        )
      ).rows[0];

      if (!product) {
        throw httpError(404, "Produit introuvable.");
      }

      await connection.query(
        `INSERT INTO order_items
           (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id, product_id)
         DO UPDATE SET
           quantity = order_items.quantity + EXCLUDED.quantity,
           subtotal =
             (order_items.quantity + EXCLUDED.quantity)
             * order_items.unit_price`,
        [
          orderId,
          product.id,
          parsed.data.quantity,
          product.price,
          Number(product.price) * parsed.data.quantity,
        ],
      );

      await connection.query(
        `UPDATE orders
         SET total_amount = (
           SELECT COALESCE(SUM(subtotal), 0)
           FROM order_items
           WHERE order_id = $1
         )
         WHERE id = $1`,
        [orderId],
      );

      await connection.query("COMMIT");
      res.status(201).json({ message: "Ligne ajoutée à la commande." });
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }),
);

router.patch(
  "/orders/:id/status",
  allowRoles("admin", "staff"),
  wrap(async (req, res) => {
    const parsed = z
      .object({
        status: z.enum(["confirmed", "cancelled", "delivered"]),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const orderId = idSchema.parse(req.params.id);
    const connection = await pool.connect();

    try {
      await connection.query("BEGIN");

      const order = (
        await connection.query(
          "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
          [orderId],
        )
      ).rows[0];

      if (!order) {
        throw httpError(404, "Commande introuvable.");
      }

      const nextStatus = parsed.data.status;

      if (order.status === "draft" && nextStatus === "confirmed") {
        const { rows: lines } = await connection.query(
          `SELECT
             oi.product_id,
             oi.quantity,
             p.stock_quantity,
             p.name
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = $1
           ORDER BY p.id
           FOR UPDATE OF p`,
          [orderId],
        );

        if (!lines.length) {
          throw httpError(
            400,
            "Ajoutez au moins un produit avant de confirmer.",
          );
        }

        for (const line of lines) {
          if (line.stock_quantity < line.quantity) {
            throw httpError(
              409,
              `Stock insuffisant pour ${line.name} ` +
                `(disponible: ${line.stock_quantity}).`,
            );
          }
        }

        for (const line of lines) {
          await connection.query(
            `UPDATE products
             SET stock_quantity = stock_quantity - $1
             WHERE id = $2`,
            [line.quantity, line.product_id],
          );

          await connection.query(
            `INSERT INTO stock_movements
               (type, product_id, quantity, reason, created_by)
             VALUES ('OUT', $1, $2, $3, $4)`,
            [
              line.product_id,
              line.quantity,
              `Commande #${orderId}`,
              req.user.id,
            ],
          );
        }
      } else if (
        order.status === "draft" &&
        nextStatus === "cancelled"
      ) {
        // Une commande brouillon peut être annulée.
      } else if (
        order.status === "confirmed" &&
        nextStatus === "delivered"
      ) {
        // Une commande confirmée peut être marquée comme livrée.
      } else {
        throw httpError(409, "Transition de statut non autorisée.");
      }

      const { rows } = await connection.query(
        `UPDATE orders
         SET status = $1
         WHERE id = $2
         RETURNING id, status, total_amount AS "totalAmount"`,
        [nextStatus, orderId],
      );

      await connection.query("COMMIT");
      res.json(rows[0]);
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }),
);

/* Mouvements de stock */

router.get(
  "/stock-movements",
  wrap(async (req, res) => {
    const productId = req.query.productId
      ? Number(req.query.productId)
      : null;

    const { rows } = await pool.query(
      `SELECT
         m.id,
         m.type,
         m.product_id AS "productId",
         p.name AS "productName",
         p.sku,
         m.quantity,
         m.reason,
         m.created_at AS "createdAt",
         u.full_name AS "createdBy"
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       JOIN users u ON u.id = m.created_by
       WHERE ($1::bigint IS NULL OR m.product_id = $1)
       ORDER BY m.created_at DESC
       LIMIT 200`,
      [productId],
    );

    res.json(rows);
  }),
);

router.post(
  "/stock-movements",
  allowRoles("admin", "staff"),
  wrap(async (req, res) => {
    const parsed = z
      .object({
        type: z.enum(["IN", "OUT"]),
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive(),
        reason: z.string().trim().min(2).max(240),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      throw httpError(400, message);
    }

    const data = parsed.data;
    const connection = await pool.connect();

    try {
      await connection.query("BEGIN");

      const product = (
        await connection.query(
          `SELECT id, stock_quantity
           FROM products
           WHERE id = $1
           FOR UPDATE`,
          [data.productId],
        )
      ).rows[0];

      if (!product) {
        throw httpError(404, "Produit introuvable.");
      }

      if (
        data.type === "OUT" &&
        product.stock_quantity < data.quantity
      ) {
        throw httpError(
          409,
          "Stock insuffisant : sortie refusée.",
        );
      }

      const delta = data.type === "IN"
        ? data.quantity
        : -data.quantity;

      await connection.query(
        `UPDATE products
         SET stock_quantity = stock_quantity + $1
         WHERE id = $2`,
        [delta, data.productId],
      );

      const { rows } = await connection.query(
        `INSERT INTO stock_movements
           (type, product_id, quantity, reason, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
           id,
           type,
           product_id AS "productId",
           quantity,
           reason,
           created_at AS "createdAt"`,
        [
          data.type,
          data.productId,
          data.quantity,
          data.reason,
          req.user.id,
        ],
      );

      await connection.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }),
);

/* Tableau de bord */

router.get(
  "/dashboard",
  wrap(async (req, res) => {
    const [products, clients, orders, topProducts] =
      await Promise.all([
        pool.query(
          "SELECT COUNT(*)::int AS count FROM products",
        ),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM clients",
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count
           FROM orders
           WHERE created_at::date = CURRENT_DATE`,
        ),
        pool.query(
          `SELECT
             p.id,
             p.name,
             p.sku,
             SUM(oi.quantity)::int AS quantity
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           WHERE o.status IN ('confirmed', 'delivered')
           GROUP BY p.id
           ORDER BY quantity DESC
           LIMIT 5`,
        ),
      ]);

    res.json({
      totalProducts: products.rows[0].count,
      totalClients: clients.rows[0].count,
      todayOrders: orders.rows[0].count,
      topProducts: topProducts.rows,
    });
  }),
);

export default router;