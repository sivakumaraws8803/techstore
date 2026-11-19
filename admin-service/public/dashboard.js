const $ = (selector) => document.querySelector(selector);
const body = $("#products-body");
const form = $("#product-form");
const formMessage = $("#form-message");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    location.replace("/login");
    throw new Error("Your session expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function requireOwner() {
  const data = await api("/api/auth/me");
  if (!data.user || data.user.role !== "owner") {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    location.replace("/login");
    throw new Error("Owner access required.");
  }
  $("#user-label").textContent = data.user.full_name || data.user.username || "Owner";
}

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function cell(value) {
  const td = document.createElement("td");
  td.textContent = value == null || value === "" ? "—" : String(value);
  return td;
}

function renderProducts(products) {
  $("#total-count").textContent = products.length;
  $("#active-count").textContent = products.filter(p => p.is_active).length;
  $("#inactive-count").textContent = products.filter(p => !p.is_active).length;
  body.replaceChildren();
  if (!products.length) {
    const tr = document.createElement("tr");
    const td = cell("No products found. Add your first product above.");
    td.colSpan = 6; td.className = "empty"; tr.append(td); body.append(tr);
    return;
  }
  for (const product of products) {
    const tr = document.createElement("tr");
    const name = cell(product.name);
    name.className = "product-name";
    tr.append(name, cell(product.category), cell(money(product.price)), cell(product.stock));
    const status = cell(product.is_active ? "Active" : "Inactive");
    status.innerHTML = product.is_active
      ? '<span class="status active">Active</span>'
      : '<span class="status inactive">Inactive</span>';
    tr.append(status);
    const action = document.createElement("td");
    if (product.is_active) {
      const button = document.createElement("button");
      button.className = "button danger small-button";
      button.textContent = "Deactivate";
      button.addEventListener("click", () => deactivateProduct(product.id, button));
      action.append(button);
    } else {
      action.textContent = "—";
    }
    tr.append(action);
    body.append(tr);
  }
}

async function loadProducts() {
  $("#list-status").textContent = "Loading…";
  try {
    const data = await api("/api/products/admin");
    renderProducts(data.products || []);
    $("#list-status").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    $("#list-status").textContent = error.message;
    body.replaceChildren();
    const tr = document.createElement("tr");
    const td = cell(error.message); td.colSpan = 6; td.className = "empty error";
    tr.append(td); body.append(tr);
  }
}

async function deactivateProduct(id, button) {
  if (!confirm("Deactivate this product? It will no longer appear in the customer catalogue.")) return;
  button.disabled = true;
  try {
    await api(`/api/products/${encodeURIComponent(id)}/deactivate`, { method: "PATCH" });
    await loadProducts();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "Saving product…";
  formMessage.className = "message";
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const payload = {
    name: $("#name").value.trim(),
    category: $("#category").value.trim(),
    price: Number($("#price").value),
    stock: Number($("#stock").value),
    brand: $("#brand").value.trim(),
    discount_percent: Number($("#discount").value || 0),
    image_url: $("#image_url").value.trim(),
    description: $("#description").value.trim()
  };
  try {
    await api("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    form.reset();
    $("#stock").value = "0";
    $("#discount").value = "0";
    formMessage.textContent = "Product added successfully.";
    formMessage.className = "message success";
    await loadProducts();
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.className = "message error";
  } finally {
    button.disabled = false;
  }
});

$("#refresh").addEventListener("click", loadProducts);
$("#logout").addEventListener("click", async () => {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
  finally { location.replace("/login"); }
});

(async () => {
  try {
    await requireOwner();
    await loadProducts();
  } catch (error) {
    if (error.message) console.error(error);
  }
})();
