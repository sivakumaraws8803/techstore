const $ = (selector) => document.querySelector(selector);
const body = $("#products-body");
const form = $("#product-form");
const modal = $("#product-modal");
let products = [];
let editingProduct = null;
let selectedImage = null;
let previewUrl = null;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { location.replace("/login"); throw new Error("Your session expired. Sign in again."); }
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}
async function requireOwner() {
  const data = await api("/api/auth/me");
  if (!data.user || data.user.role !== "owner") {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    location.replace("/login");
    throw new Error("Owner access required.");
  }
  const label = data.user.full_name || data.user.username || "Store owner";
  $("#user-label").textContent = label;
  $("#avatar").textContent = label.trim().charAt(0).toUpperCase();
}
const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const stockState = p => Number(p.stock) <= 0 ? "out" : Number(p.stock) <= 5 ? "low" : "healthy";
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function imageElement(product) {
  const wrap = node("div", "product-thumb");
  if (product.image_url) {
    const img = document.createElement("img");
    img.src = product.image_url; img.alt = product.name || "Product image"; img.loading = "lazy";
    img.onerror = () => { wrap.replaceChildren(node("span", "", "▧")); };
    wrap.append(img);
  } else wrap.append(node("span", "", "▧"));
  return wrap;
}
function filteredProducts() {
  const term = $("#search").value.trim().toLowerCase();
  const category = $("#category-filter").value;
  const status = $("#status-filter").value;
  return products.filter(p => {
    const matchesTerm = !term || [p.name, p.category, p.brand, String(p.id)].some(v => String(v || "").toLowerCase().includes(term));
    const matchesCategory = !category || p.category === category;
    const state = stockState(p);
    const matchesStatus = status === "all" || (status === "active" && p.is_active) ||
      (status === "inactive" && !p.is_active) || (status === "low" && state === "low") || (status === "out" && state === "out");
    return matchesTerm && matchesCategory && matchesStatus;
  });
}
function updateMetrics() {
  $("#total-count").textContent = products.length;
  $("#active-count").textContent = products.filter(p => p.is_active).length;
  $("#low-count").textContent = products.filter(p => p.is_active && stockState(p) === "low").length;
  $("#out-count").textContent = products.filter(p => p.is_active && stockState(p) === "out").length;
  $("#nav-product-count").textContent = products.length;
}
function updateCategoryFilter() {
  const select = $("#category-filter"), current = select.value;
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  select.replaceChildren(new Option("All categories", ""));
  categories.forEach(c => select.add(new Option(c, c)));
  select.value = categories.includes(current) ? current : "";
}
function renderProducts() {
  const rows = filteredProducts();
  body.replaceChildren();
  $("#list-status").textContent = rows.length + (rows.length === 1 ? " product" : " products");
  $("#table-summary").textContent = "Showing " + rows.length + " of " + products.length + " products";
  $("#select-all").checked = false;
  if (!rows.length) {
    const tr = document.createElement("tr"), td = node("td", "empty", products.length ? "No products match these filters." : "Your catalogue is empty. Add your first product to get started.");
    td.colSpan = 7; tr.append(td); body.append(tr); return;
  }
  for (const p of rows) {
    const tr = document.createElement("tr");
    const checkCell = node("td", "check-col");
    const check = document.createElement("input"); check.type = "checkbox"; check.className = "row-check"; check.setAttribute("aria-label", "Select " + p.name); checkCell.append(check);
    const productCell = node("td", "product-cell");
    productCell.append(imageElement(p));
    const info = node("div", "product-info"); info.append(node("b", "", p.name || "Unnamed product"), node("small", "", "SKU · TS-" + String(p.id).padStart(5, "0")));
    productCell.append(info);
    const statusCell = node("td");
    statusCell.append(node("span", "pill " + (p.is_active ? "pill-active" : "pill-muted"), p.is_active ? "Active" : "Inactive"));
    const priceCell = node("td", "price-cell", money(p.price));
    const inventoryCell = node("td");
    const state = stockState(p);
    inventoryCell.append(node("span", "stock-number " + (state === "out" ? "stock-out" : state === "low" ? "stock-low" : ""), Number(p.stock) + " units"));
    if (state !== "healthy") inventoryCell.append(node("small", "stock-hint " + state, state === "out" ? "Out of stock" : "Low stock"));
    const categoryCell = node("td", "category-cell", p.category || "—");
    const actionCell = node("td", "actions-cell");
    const edit = node("button", "row-action", "Edit"); edit.type = "button"; edit.addEventListener("click", () => openModal(p));
    actionCell.append(edit);
    if (p.is_active) {
      const deactivate = node("button", "row-action danger-text", "Deactivate"); deactivate.type = "button";
      deactivate.addEventListener("click", () => deactivateProduct(p, deactivate)); actionCell.append(deactivate);
    } else {
      const activate = node("button", "row-action", "Activate"); activate.type = "button";
      activate.addEventListener("click", () => activateProduct(p, activate)); actionCell.append(activate);
    }
    tr.append(checkCell, productCell, statusCell, priceCell, inventoryCell, categoryCell, actionCell);
    body.append(tr);
  }
}
async function loadProducts() {
  $("#list-status").textContent = "Syncing…";
  try {
    const data = await api("/api/products/admin");
    products = Array.isArray(data.products) ? data.products : [];
    updateMetrics(); updateCategoryFilter(); renderProducts();
    $("#last-updated").textContent = "Synced " + new Date().toLocaleTimeString();
  } catch (error) {
    $("#list-status").textContent = error.message;
    body.replaceChildren();
    const tr = document.createElement("tr"), td = node("td", "empty error-text", error.message); td.colSpan = 7; tr.append(td); body.append(tr);
  }
}
function setPreview(src) {
  const preview = $("#image-preview"); preview.replaceChildren();
  if (src) {
    const img = document.createElement("img"); img.src = src; img.alt = "Selected product preview"; preview.append(img);
  } else { preview.append(node("span", "", "▧"), node("small", "", "Product image")); }
}
function openModal(product = null) {
  editingProduct = product;
  selectedImage = null;
  form.reset();
  $("#modal-title").textContent = product ? "Edit product" : "Add a product";
  $("#save-product").textContent = product ? "Save changes" : "Save product";
  $("#form-message").textContent = "";
  $("#stock").value = product ? product.stock : 0;
  $("#discount").value = product ? product.discount_percent || 0 : 0;
  if (product) {
    $("#name").value = product.name || ""; $("#category").value = product.category || "";
    $("#brand").value = product.brand || ""; $("#price").value = product.price ?? "";
    $("#description").value = product.description || "";
    setPreview(product.image_url || "");
  } else setPreview("");
  modal.hidden = false; document.body.classList.add("modal-open"); $("#name").focus();
}
function closeModal() {
  modal.hidden = true; document.body.classList.remove("modal-open");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null; selectedImage = null; editingProduct = null;
}
async function deactivateProduct(product, button) {
  if (!confirm("Deactivate “" + product.name + "”? It will no longer appear in the customer storefront.")) return;
  button.disabled = true;
  try { await api("/api/products/" + encodeURIComponent(product.id) + "/deactivate", { method: "PATCH" }); await loadProducts(); }
  catch (error) { alert(error.message); button.disabled = false; }
}

async function activateProduct(product, button) {
  if (!confirm("Activate “" + product.name + "” and make it visible in the customer storefront?")) return;
  button.disabled = true;
  try {
    await api("/api/products/" + encodeURIComponent(product.id) + "/activate", { method: "PATCH" });
    await loadProducts();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
}
$("#image").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { $("#form-message").textContent = "Choose an image smaller than 5 MB."; event.target.value = ""; return; }
  if (!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) { $("#form-message").textContent = "Choose a JPG, PNG, WEBP or AVIF image."; event.target.value = ""; return; }
  selectedImage = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file); setPreview(previewUrl); $("#form-message").textContent = "";
});
$("#choose-image").addEventListener("click", () => $("#image").click());
$("#remove-image").addEventListener("click", () => { selectedImage = null; $("#image").value = ""; setPreview(editingProduct?.image_url || ""); });
form.addEventListener("submit", async event => {
  event.preventDefault();
  const save = $("#save-product"); save.disabled = true; $("#form-message").textContent = "Saving product…";
  const payload = new FormData();
  payload.append("name", $("#name").value.trim()); payload.append("category", $("#category").value.trim());
  payload.append("price", $("#price").value); payload.append("stock", $("#stock").value);
  payload.append("brand", $("#brand").value.trim()); payload.append("discount_percent", $("#discount").value || "0");
  payload.append("description", $("#description").value.trim());
  if (selectedImage) payload.append("image", selectedImage);
  else if (editingProduct?.image_url) payload.append("image_url", editingProduct.image_url);
  try {
    await api(editingProduct ? "/api/products/" + encodeURIComponent(editingProduct.id) : "/api/products/", {
      method: editingProduct ? "PUT" : "POST", body: payload
    });
    closeModal(); await loadProducts();
  } catch (error) { $("#form-message").textContent = error.message; $("#form-message").className = "form-message error-text"; }
  finally { save.disabled = false; }
});
$("#add-product").addEventListener("click", () => openModal());
$("#add-product-top").addEventListener("click", () => openModal());
$("#close-modal").addEventListener("click", closeModal);
$("#cancel-modal").addEventListener("click", closeModal);
modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeModal(); });
$("#search").addEventListener("input", renderProducts);
$("#category-filter").addEventListener("change", renderProducts);
$("#status-filter").addEventListener("change", renderProducts);
$("#refresh").addEventListener("click", loadProducts);
$("#select-all").addEventListener("change", event => document.querySelectorAll(".row-check").forEach(c => c.checked = event.target.checked));
async function logout() {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
  finally { location.replace("/login"); }
}
$("#logout").addEventListener("click", logout);
$("#logout-top").addEventListener("click", logout);
$("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("sidebar-open"));
(async () => { try { await requireOwner(); await loadProducts(); } catch (error) { console.error(error); } })();