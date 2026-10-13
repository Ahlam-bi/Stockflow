import { useCallback, useEffect, useState } from "react";
import { api, setToken } from "./api";

const cash = (n) => `${Number(n || 0).toLocaleString("fr-MA")} DH`;

function Login({ done }) {
  const [email, setEmail] = useState("admin@stockflow.local");
  const [password, setPassword] = useState("Stockflow123!");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();

    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(result.token);
      done(result.user);
    } catch (requestError) {
      setError(requestError.message);
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
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button>Se connecter</button>
        <small>Démo : admin@stockflow.local / Stockflow123!</small>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("Dashboard");
  const [editingClient, setEditingClient] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [dashboard, setDashboard] = useState({});
  const [products, setProducts] = useState({
    items: [],
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [dashboardData, productData, clientData, categoryData, orderData, movementData] =
        await Promise.all([
          api("/dashboard"),
          api(
            `/products?search=${encodeURIComponent(search)}&page=${page}&limit=8`,
          ),
          api(`/clients?search=${encodeURIComponent(search)}`),
          api("/categories"),
          api("/orders"),
          api("/stock-movements"),
        ]);

      setDashboard(dashboardData);
      setProducts(productData);
      setClients(clientData);
      setCategories(categoryData);
      setOrders(orderData);
      setMovements(movementData);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [user, search, page]);

  useEffect(() => {
    const savedToken = localStorage.getItem("stockflow_token");

    if (savedToken) {
      setToken(savedToken);
      api("/auth/me")
        .then(setUser)
        .catch(() => setToken(null));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function action(request, successMessage) {
    try {
      await request();
      setNotice(successMessage);
      setError("");
      await load();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  async function saveClient(event) {
    event.preventDefault();

    const saved = await action(
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

    if (saved) setEditingClient(null);
  }

  async function saveProduct(event) {
    event.preventDefault();

    const saved = await action(
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

    if (saved) setEditingProduct(null);
  }

  if (!user) return <Login done={setUser} />;

  const navigation = [
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

  function renderPage() {
    if (view === "Dashboard") {
      return (
        <>
          <div className="cards">
            {[
              ["Produits", dashboard.totalProducts],
              ["Clients", dashboard.totalClients],
              ["Commandes aujourd'hui", dashboard.todayOrders],
              ["Top produits", dashboard.topProducts?.length || 0],
            ].map(([label, value]) => (
              <article className="card" key={label}>
                <small>{label}</small>
                <strong>{value ?? 0}</strong>
              </article>
            ))}
          </div>
          <section className="panel">
            <h2>Top 5 produits vendus</h2>
            <Rows
              rows={dashboard.topProducts || []}
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
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action(
                () =>
                  api("/products", {
                    method: "POST",
                    body: JSON.stringify({
                      name: form.get("name"),
                      sku: form.get("sku"),
                      price: Number(form.get("price")),
                      categoryId: Number(form.get("categoryId")),
                    }),
                  }),
                "Produit ajouté.",
              );
              event.currentTarget.reset();
            }}
          >
            {field("name", "Nom produit")}
            {field("sku", "SKU")}
            {field("price", "Prix", "number")}
            <select name="categoryId" required>
              <option value="">Catégorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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
            actions={(product) => (
              <>
                <button
                  className="link"
                  onClick={() => setEditingProduct({ ...product })}
                >
                  Modifier
                </button>
                {isAdmin && (
                  <button
                    className="link danger"
                    onClick={() =>
                      confirm("Supprimer ce produit ?") &&
                      action(
                        () =>
                          api(`/products/${product.id}`, {
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
            go={setPage}
          />

          {editingProduct && (
            <div className="modal-backdrop">
              <form className="modal-card" onSubmit={saveProduct}>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setEditingProduct(null)}
                >
                  ×
                </button>
                <p className="eyebrow">FICHE PRODUIT</p>
                <h2>Modifier le produit</h2>
                <label>
                  Nom du produit
                  <input
                    value={editingProduct.name}
                    onChange={(event) =>
                      setEditingProduct({
                        ...editingProduct,
                        name: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  SKU
                  <input
                    value={editingProduct.sku}
                    onChange={(event) =>
                      setEditingProduct({
                        ...editingProduct,
                        sku: event.target.value,
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
                    onChange={(event) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Catégorie
                  <select
                    value={editingProduct.categoryId}
                    onChange={(event) =>
                      setEditingProduct({
                        ...editingProduct,
                        categoryId: event.target.value,
                      })
                    }
                    required
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingProduct(null)}
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
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action(
                () =>
                  api("/clients", {
                    method: "POST",
                    body: JSON.stringify({
                      fullName: form.get("fullName"),
                      phone: form.get("phone"),
                      email: form.get("email"),
                    }),
                  }),
                "Client ajouté.",
              );
              event.currentTarget.reset();
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
            actions={(client) => (
              <button
                className="link"
                onClick={() => setEditingClient({ ...client })}
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
                  onClick={() => setEditingClient(null)}
                >
                  ×
                </button>
                <p className="eyebrow">FICHE CLIENT</p>
                <h2>Modifier le client</h2>
                <label>
                  Nom complet
                  <input
                    value={editingClient.fullName}
                    onChange={(event) =>
                      setEditingClient({
                        ...editingClient,
                        fullName: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Téléphone
                  <input
                    value={editingClient.phone}
                    onChange={(event) =>
                      setEditingClient({
                        ...editingClient,
                        phone: event.target.value,
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
                    onChange={(event) =>
                      setEditingClient({
                        ...editingClient,
                        email: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingClient(null)}
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
          {isAdmin && (
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                const name = new FormData(event.currentTarget).get("name");
                action(
                  () =>
                    api("/categories", {
                      method: "POST",
                      body: JSON.stringify({ name }),
                    }),
                  "Catégorie ajoutée.",
                );
                event.currentTarget.reset();
              }}
            >
              {field("name", "Nom catégorie")}
              <button>Ajouter</button>
            </Form>
          )}
          <Rows
            rows={categories}
            cols={[
              ["name", "Nom"],
              [
                "createdAt",
                "Créée le",
                (value) => new Date(value).toLocaleDateString("fr-FR"),
              ],
            ]}
            actions={
              isAdmin
                ? (category) => (
                    <>
                      <button
                        className="link"
                        onClick={() => {
                          const name = prompt("Nom", category.name);
                          if (name) {
                            action(
                              () =>
                                api(`/categories/${category.id}`, {
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
                              api(`/categories/${category.id}`, {
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
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                action(async () => {
                  const order = await api("/orders", {
                    method: "POST",
                    body: JSON.stringify({
                      clientId: Number(form.get("clientId")),
                    }),
                  });
                  if (form.get("productId")) {
                    await api(`/orders/${order.id}/items`, {
                      method: "POST",
                      body: JSON.stringify({
                        productId: Number(form.get("productId")),
                        quantity: Number(form.get("quantity")),
                      }),
                    });
                  }
                }, "Commande créée.");
                event.currentTarget.reset();
              }}
            >
              <select name="clientId" required>
                <option value="">Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName}
                  </option>
                ))}
              </select>
              <select name="productId">
                <option value="">Sans article</option>
                {products.items.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {cash(product.price)}
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
            {orders.map((order) => (
              <article className="order" key={order.id}>
                <b>
                  #{order.id} · {order.clientName}
                </b>
                <span className={`badge ${order.status}`}>
                  {order.status}
                </span>
                <p>
                  {order.items
                    .map((item) => `${item.quantity}× ${item.productName}`)
                    .join(" · ") || "Aucun article"}
                </p>
                <b>{cash(order.totalAmount)}</b>
                {order.status === "draft" && (
                  <>
                    <form
                      className="form compact"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        action(
                          () =>
                            api(`/orders/${order.id}/items`, {
                              method: "POST",
                              body: JSON.stringify({
                                productId: Number(form.get("productId")),
                                quantity: Number(form.get("quantity")),
                              }),
                            }),
                          "Article ajouté.",
                        );
                      }}
                    >
                      <select name="productId" required>
                        <option value="">Produit</option>
                        {products.items.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
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
                            api(`/orders/${order.id}/status`, {
                              method: "PATCH",
                              body: JSON.stringify({ status: "confirmed" }),
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
                            api(`/orders/${order.id}/status`, {
                              method: "PATCH",
                              body: JSON.stringify({ status: "cancelled" }),
                            }),
                          "Commande annulée.",
                        )
                      }
                    >
                      Annuler
                    </button>
                  </>
                )}
                {order.status === "confirmed" && (
                  <button
                    onClick={() =>
                      action(
                        () =>
                          api(`/orders/${order.id}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "delivered" }),
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
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action(
                () =>
                  api("/stock-movements", {
                    method: "POST",
                    body: JSON.stringify({
                      type: form.get("type"),
                      productId: Number(form.get("productId")),
                      quantity: Number(form.get("quantity")),
                      reason: form.get("reason"),
                    }),
                  }),
                "Mouvement enregistré.",
              );
              event.currentTarget.reset();
            }}
          >
            <select name="type">
              <option value="IN">Entrée</option>
              <option value="OUT">Sortie</option>
            </select>
            <select name="productId" required>
              <option value="">Produit</option>
              {products.items.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · stock {product.stockQuantity}
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
            rows={movements}
            cols={[
              ["type", "Type"],
              ["productName", "Produit"],
              ["quantity", "Quantité"],
              ["reason", "Motif"],
              ["createdBy", "Créé par"],
              [
                "createdAt",
                "Date",
                (value) => new Date(value).toLocaleString("fr-FR"),
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
        {navigation.map((item) => (
          <button
            className={view === item ? "nav selected" : "nav"}
            onClick={() => setView(item)}
            key={item}
          >
            {item}
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
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            )}
          </div>
          {notice && <p className="success">✓ {notice}</p>}
          {error && <p className="error">{error}</p>}
          {renderPage()}
          <footer>StockFlow · Mini ERP gestion des stocks & commandes</footer>
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
            {cols.map((column) => (
              <th key={column[0]}>{column[1]}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {cols.map((column) => (
                <td key={column[0]}>
                  {column[2]
                    ? column[2](row[column[0]])
                    : row[column[0]] ?? "—"}
                </td>
              ))}
              {actions && <td>{actions(row)}</td>}
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
      <span>Page {page} / {pages}</span>
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

