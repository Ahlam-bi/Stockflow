import { useCallback, useEffect, useState } from "react";
import { api, setToken } from "./api";

const cash = (n) => `${Number(n || 0).toLocaleString("fr-MA")} DH`;

function Login({ done }) {
  const [email, E] = useState("admin@stockflow.local");
  const [password, P] = useState("Stockflow123!");
  const [err, S] = useState("");

  async function submit(e) {
    e.preventDefault();

    try {
      const r = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setToken(r.token);
      done(r.user);
    } catch (x) {
      S(x.message);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <div className="logo">S</div>
        <p className="eyebrow">GESTION COMMERCIALE</p>
        <h1>StockFlow</h1>
        <p>Connectez-vous à votre espace.</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => E(e.target.value)}
          />
        </label>

        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => P(e.target.value)}
          />
        </label>

        {err && <p className="error">{err}</p>}

        <button>Se connecter</button>
        <small>Démo : admin@stockflow.local / Stockflow123!</small>
      </form>
    </div>
  );
}

export default function App() {
  const [user, U] = useState(null);
  const [view, V] = useState("Dashboard");
  const [editingClient, EditClient] = useState(null);
  const [editingProduct, EditProduct] = useState(null);
  const [dash, D] = useState({});
  const [products, Pr] = useState({
    items: [],
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [clients, C] = useState([]);
  const [cats, Ca] = useState([]);
  const [orders, O] = useState([]);
  const [moves, M] = useState([]);
  const [search, Q] = useState("");
  const [page, Page] = useState(1);
  const [notice, N] = useState("");
  const [error, Err] = useState("");

  const admin = user?.role === "admin";

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [d, p, c, ca, o, m] = await Promise.all([
        api("/dashboard"),
        api(
          `/products?search=${encodeURIComponent(search)}&page=${page}&limit=8`,
        ),
        api(`/clients?search=${encodeURIComponent(search)}`),
        api("/categories"),
        api("/orders"),
        api("/stock-movements"),
      ]);

      D(d);
      Pr(p);
      C(c);
      Ca(ca);
      O(o);
      M(m);
      Err("");
    } catch (e) {
      Err(e.message);
    }
  }, [user, search, page]);

  useEffect(() => {
    const t = localStorage.getItem("stockflow_token");

    if (t) {
      setToken(t);
      api("/auth/me")
        .then(U)
        .catch(() => setToken(null));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function action(fn, msg) {
    try {
      await fn();
      N(msg);
      Err("");
      await load();
      return true;
    } catch (e) {
      Err(e.message);
      return false;
    }
  }

  function logout() {
    setToken(null);
    U(null);
  }

  async function saveClient(e) {
    e.preventDefault();

    const ok = await action(
      () =>
        api(`/clients/${editingClient.id}`, {
          method: "PUT",
          body: JSON.stringify({
            fullName: editingClient.fullName,
            phone: editingClient.phone,
            email: editingClient.email || null,
          }),
        }),
      "Client modifié.",
    );

    if (ok) EditClient(null);
  }

  async function saveProduct(e) {
    e.preventDefault();

    const ok = await action(
      () =>
        api(`/products/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: editingProduct.name,
            sku: editingProduct.sku,
            price: Number(editingProduct.price),
            categoryId: Number(editingProduct.categoryId),
          }),
        }),
      "Produit modifié.",
    );

    if (ok) EditProduct(null);
  }

  if (!user) return <Login done={U} />;

  const nav = [
    "Dashboard",
    "Produits",
    "Clients",
    "Commandes",
    "Stock",
    "Catégories",
  ];

  const Form = ({ children, onSubmit }) => (
    <form className="form" onSubmit={onSubmit}>
      {children}
    </form>
  );

  const field = (name, placeholder, type = "text", required = true) => (
    <input
      name={name}
      placeholder={placeholder}
      type={type}
      required={required}
    />
  );

  function render() {
    if (view === "Dashboard") {
      return (
        <>
          <div className="cards">
            {[
              ["Produits", dash.totalProducts],
              ["Clients", dash.totalClients],
              ["Commandes aujourd'hui", dash.todayOrders],
              ["Top produits", dash.topProducts?.length || 0],
            ].map((x) => (
              <article className="card" key={x[0]}>
                <small>{x[0]}</small>
                <strong>{x[1] ?? 0}</strong>
              </article>
            ))}
          </div>

          <section className="panel">
            <h2>Top 5 produits vendus</h2>
            <Rows
              rows={dash.topProducts || []}
              cols={[
                ["name", "Produit"],
                ["sku", "SKU"],
                ["quantity", "Quantité"],
              ]}
            />
          </section>
        </>
      );
    }

    if (view === "Produits") {
      return (
        <section className="panel">
          <h2>Catalogue produits</h2>

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);

              action(
                () =>
                  api("/products", {
                    method: "POST",
                    body: JSON.stringify({
                      name: f.get("name"),
                      sku: f.get("sku"),
                      price: Number(f.get("price")),
                      categoryId: Number(f.get("categoryId")),
                    }),
                  }),
                "Produit ajouté.",
              );

              e.currentTarget.reset();
            }}
          >
            {field("name", "Nom produit")}
            {field("sku", "SKU")}
            {field("price", "Prix", "number")}

            <select name="categoryId" required>
              <option value="">Catégorie</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button>Ajouter</button>
          </Form>

          <Rows
            rows={products.items}
            cols={[
              ["name", "Produit"],
              ["sku", "SKU"],
              ["categoryName", "Catégorie"],
              ["price", "Prix", cash],
              ["stockQuantity", "Stock"],
            ]}
            actions={(p) => (
              <>
                <button
                  className="link"
                  onClick={() => EditProduct({ ...p })}
                >
                  Modifier
                </button>

                {admin && (
                  <button
                    className="link danger"
                    onClick={() =>
                      confirm("Supprimer ce produit ?") &&
                      action(
                        () =>
                          api(`/products/${p.id}`, {
                            method: "DELETE",
                          }),
                        "Produit supprimé.",
                      )
                    }
                  >
                    Supprimer
                  </button>
                )}
              </>
            )}
          />

          <Pager
            page={page}
            pages={products.totalPages || 1}
            go={Page}
          />

          {editingProduct && (
            <div className="modal-backdrop">
              <form className="modal-card" onSubmit={saveProduct}>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => EditProduct(null)}
                >
                  ×
                </button>

                <p className="eyebrow">FICHE PRODUIT</p>
                <h2>Modifier le produit</h2>

                <label>
                  Nom du produit
                  <input
                    value={editingProduct.name}
                    onChange={(e) =>
                      EditProduct({
                        ...editingProduct,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  SKU
                  <input
                    value={editingProduct.sku}
                    onChange={(e) =>
                      EditProduct({
                        ...editingProduct,
                        sku: e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Prix (DH)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) =>
                      EditProduct({
                        ...editingProduct,
                        price: e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Catégorie
                  <select
                    value={editingProduct.categoryId}
                    onChange={(e) =>
                      EditProduct({
                        ...editingProduct,
                        categoryId: e.target.value,
                      })
                    }
                    required
                  >
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => EditProduct(null)}
                  >
                    Annuler
                  </button>

                  <button>Enregistrer les changements</button>
                </div>
              </form>
            </div>
          )}
        </section>
      );
    }

    if (view === "Clients") {
      return (
        <section className="panel">
          <h2>Clients</h2>

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);

              action(
                () =>
                  api("/clients", {
                    method: "POST",
                    body: JSON.stringify({
                      fullName: f.get("fullName"),
                      phone: f.get("phone"),
                      email: f.get("email"),
                    }),
                  }),
                "Client ajouté.",
              );

              e.currentTarget.reset();
            }}
          >
            {field("fullName", "Nom complet")}
            {field("phone", "Téléphone")}
            {field("email", "Email", "email", false)}
            <button>Ajouter client</button>
          </Form>

          <Rows
            rows={clients}
            cols={[
              ["fullName", "Nom"],
              ["phone", "Téléphone"],
              ["email", "Email"],
            ]}
            actions={(c) => (
              <button
                className="link"
                onClick={() => EditClient({ ...c })}
              >
                Modifier
              </button>
            )}
          />

          {editingClient && (
            <div className="modal-backdrop">
              <form className="modal-card" onSubmit={saveClient}>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => EditClient(null)}
                >
                  ×
                </button>

                <p className="eyebrow">FICHE CLIENT</p>
                <h2>Modifier le client</h2>

                <label>
                  Nom complet
                  <input
                    value={editingClient.fullName}
                    onChange={(e) =>
                      EditClient({
                        ...editingClient,
                        fullName: e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Téléphone
                  <input
                    value={editingClient.phone}
                    onChange={(e) =>
                      EditClient({
                        ...editingClient,
                        phone: e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={editingClient.email || ""}
                    onChange={(e) =>
                      EditClient({
                        ...editingClient,
                        email: e.target.value,
                      })
                    }
                  />
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => EditClient(null)}
                  >
                    Annuler
                  </button>

                  <button>Enregistrer les changements</button>
                </div>
              </form>
            </div>
          )}
        </section>
      );
    }

    if (view === "Catégories") {
      return (
        <section className="panel">
          <h2>Catégories</h2>

          {admin && (
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                const name = new FormData(e.currentTarget).get("name");

                action(
                  () =>
                    api("/categories", {
                      method: "POST",
                      body: JSON.stringify({ name }),
                    }),
                  "Catégorie ajoutée.",
                );

                e.currentTarget.reset();
              }}
            >
              {field("name", "Nom catégorie")}
              <button>Ajouter</button>
            </Form>
          )}

          <Rows
            rows={cats}
            cols={[
              ["name", "Nom"],
              [
                "createdAt",
                "Créée le",
                (v) => new Date(v).toLocaleDateString("fr-FR"),
              ],
            ]}
            actions={
              admin
                ? (c) => (
                    <>
                      <button
                        className="link"
                        onClick={() => {
                          const name = prompt("Nom", c.name);

                          if (name) {
                            action(
                              () =>
                                api(`/categories/${c.id}`, {
                                  method: "PUT",
                                  body: JSON.stringify({ name }),
                                }),
                              "Catégorie modifiée.",
                            );
                          }
                        }}
                      >
                        Modifier
                      </button>

                      <button
                        className="link danger"
                        onClick={() =>
                          confirm("Supprimer ?") &&
                          action(
                            () =>
                              api(`/categories/${c.id}`, {
                                method: "DELETE",
                              }),
                            "Catégorie supprimée.",
                          )
                        }
                      >
                        Supprimer
                      </button>
                    </>
                  )
                : null
            }
          />
        </section>
      );
    }

    if (view === "Commandes") {
      return (
        <>
          <section className="panel">
            <h2>Nouvelle commande brouillon</h2>

            <Form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);

                action(async () => {
                  const o = await api("/orders", {
                    method: "POST",
                    body: JSON.stringify({
                      clientId: Number(f.get("clientId")),
                    }),
                  });

                  if (f.get("productId")) {
                    await api(`/orders/${o.id}/items`, {
                      method: "POST",
                      body: JSON.stringify({
                        productId: Number(f.get("productId")),
                        quantity: Number(f.get("quantity")),
                      }),
                    });
                  }
                }, "Commande créée.");

                e.currentTarget.reset();
              }}
            >
              <select name="clientId" required>
                <option value="">Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>

              <select name="productId">
                <option value="">Sans article</option>
                {products.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {cash(p.price)}
                  </option>
                ))}
              </select>

              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
              />

              <button>Créer</button>
            </Form>
          </section>

          <section className="panel">
            <h2>Commandes</h2>

            {orders.map((o) => (
              <article className="order" key={o.id}>
                <b>
                  #{o.id} · {o.clientName}
                </b>

                <span className={`badge ${o.status}`}>
                  {o.status}
                </span>

                <p>
                  {o.items
                    .map((i) => `${i.quantity}× ${i.productName}`)
                    .join(" · ") || "Aucun article"}
                </p>

                <b>{cash(o.totalAmount)}</b>

                {o.status === "draft" && (
                  <>
                    <form
                      className="form compact"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);

                        action(
                          () =>
                            api(`/orders/${o.id}/items`, {
                              method: "POST",
                              body: JSON.stringify({
                                productId: Number(f.get("productId")),
                                quantity: Number(f.get("quantity")),
                              }),
                            }),
                          "Article ajouté.",
                        );
                      }}
                    >
                      <select name="productId" required>
                        <option value="">Produit</option>
                        {products.items.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      <input
                        name="quantity"
                        type="number"
                        min="1"
                        defaultValue="1"
                      />

                      <button>Ajouter ligne</button>
                    </form>

                    <button
                      onClick={() =>
                        action(
                          () =>
                            api(`/orders/${o.id}/status`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                status: "confirmed",
                              }),
                            }),
                          "Commande confirmée.",
                        )
                      }
                    >
                      Confirmer
                    </button>

                    <button
                      className="secondary"
                      onClick={() =>
                        action(
                          () =>
                            api(`/orders/${o.id}/status`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                status: "cancelled",
                              }),
                            }),
                          "Commande annulée.",
                        )
                      }
                    >
                      Annuler
                    </button>
                  </>
                )}

                {o.status === "confirmed" && (
                  <button
                    onClick={() =>
                      action(
                        () =>
                          api(`/orders/${o.id}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              status: "delivered",
                            }),
                          }),
                        "Commande livrée.",
                      )
                    }
                  >
                    Marquer livrée
                  </button>
                )}
              </article>
            ))}
          </section>
        </>
      );
    }

    return (
      <>
        <section className="panel">
          <h2>Mouvement de stock</h2>

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);

              action(
                () =>
                  api("/stock-movements", {
                    method: "POST",
                    body: JSON.stringify({
                      type: f.get("type"),
                      productId: Number(f.get("productId")),
                      quantity: Number(f.get("quantity")),
                      reason: f.get("reason"),
                    }),
                  }),
                "Mouvement enregistré.",
              );

              e.currentTarget.reset();
            }}
          >
            <select name="type">
              <option value="IN">Entrée</option>
              <option value="OUT">Sortie</option>
            </select>

            <select name="productId" required>
              <option value="">Produit</option>
              {products.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · stock {p.stockQuantity}
                </option>
              ))}
            </select>

            <input
              name="quantity"
              type="number"
              min="1"
              placeholder="Quantité"
              required
            />

            {field("reason", "Motif")}
            <button>Enregistrer</button>
          </Form>
        </section>

        <section className="panel">
          <h2>Historique</h2>

          <Rows
            rows={moves}
            cols={[
              ["type", "Type"],
              ["productName", "Produit"],
              ["quantity", "Quantité"],
              ["reason", "Motif"],
              ["createdBy", "Créé par"],
              [
                "createdAt",
                "Date",
                (v) => new Date(v).toLocaleString("fr-FR"),
              ],
            ]}
          />
        </section>
      </>
    );
  }

  return (
    <div className="layout">
      <aside>
        <div className="brand">
          <span className="logo">S</span>
          <b>stockflow</b>
        </div>

        <p className="eyebrow">MENU</p>

        {nav.map((n) => (
          <button
            className={view === n ? "nav selected" : "nav"}
            onClick={() => V(n)}
            key={n}
          >
            {n}
          </button>
        ))}

        <div className="profile">
          <b>{user.fullName}</b>
          <small>{user.role}</small>
          <button className="link" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <main>
        <header>
          <span>StockFlow / {view}</span>
          <button className="secondary" onClick={load}>
            Actualiser ↻
          </button>
        </header>

        <div className="content">
          <div className="title">
            <div>
              <p className="eyebrow">ESPACE PRINCIPAL</p>
              <h1>{view}</h1>
            </div>

            {view !== "Dashboard" && (
              <input
                className="search"
                placeholder="Recherche nom / SKU / téléphone"
                value={search}
                onChange={(e) => {
                  Q(e.target.value);
                  Page(1);
                }}
              />
            )}
          </div>

          {notice && <p className="success">✓ {notice}</p>}
          {error && <p className="error">{error}</p>}

          {render()}

          <footer>
            StockFlow · Mini ERP gestion des stocks & commandes
          </footer>
        </div>
      </main>
    </div>
  );
}

function Rows({ rows, cols, actions }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c[0]}>{c[1]}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              {cols.map((c) => (
                <td key={c[0]}>
                  {c[2] ? c[2](r[c[0]]) : r[c[0]] ?? "—"}
                </td>
              ))}
              {actions && <td>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {!rows.length && (
        <p className="empty">Aucune donnée pour le moment.</p>
      )}
    </div>
  );
}

function Pager({ page, pages, go }) {
  return (
    <div className="pager">
      <span>
        Page {page} / {pages}
      </span>

      <button
        className="secondary"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        Précédent
      </button>

      <button
        className="secondary"
        disabled={page >= pages}
        onClick={() => go(page + 1)}
      >
        Suivant
      </button>
    </div>
  );
}