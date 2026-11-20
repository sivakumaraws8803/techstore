const $ = selector => document.querySelector(selector);
let categories = [];
let editingCategory = null;
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
    location.replace("/login"); throw new Error("Owner access required.");
  }
  const label = data.user.full_name || data.user.username || "Store owner";
  $("#user-label").textContent = label; $("#avatar").textContent = label.trim().charAt(0).toUpperCase();
}
function filtered() {
  const term = $("#search").value.trim().toLowerCase(), status = $("#status-filter").value;
  return categories.filter(c => (!term || [c.name,c.slug,c.description].some(v => String(v || "").toLowerCase().includes(term))) &&
    (status === "all" || (status === "active" && c.is_active) || (status === "inactive" && !c.is_active)));
}
function render() {
  const rows = filtered(), body = $("#categories-body"); body.replaceChildren();
  $("#list-status").textContent = rows.length + (rows.length === 1 ? " category" : " categories");
  $("#table-summary").textContent = "Showing " + rows.length + " of " + categories.length + " categories";
  if (!rows.length) { const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=5;td.className="empty";td.textContent="No categories found.";tr.append(td);body.append(tr);return; }
  for (const c of rows) {
    const tr=document.createElement("tr"), name=document.createElement("td"), b=document.createElement("b"), desc=document.createElement("small");
    name.className="category-name-cell";b.textContent=c.name;desc.textContent=c.description || "No description";name.append(b,desc);
    const slug=document.createElement("td");slug.className="slug-cell";slug.textContent=c.slug;
    const count=document.createElement("td");count.textContent=String(c.product_count || 0);
    const status=document.createElement("td"), pill=document.createElement("span");pill.className="pill "+(c.is_active?"pill-active":"pill-muted");pill.textContent=c.is_active?"Active":"Inactive";status.append(pill);
    const actions=document.createElement("td");actions.className="actions-cell";
    const edit=document.createElement("button");edit.className="row-action";edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>openModal(c));actions.append(edit);
    const toggle=document.createElement("button");toggle.className="row-action "+(c.is_active?"danger-text":"");toggle.type="button";toggle.textContent=c.is_active?"Deactivate":"Activate";toggle.addEventListener("click",()=>toggleStatus(c,toggle));actions.append(toggle);
    tr.append(name,slug,count,status,actions);body.append(tr);
  }
}
async function load() {
  $("#list-status").textContent="Syncing…";
  try {
    const data=await api("/api/products/categories");categories=data.categories || [];
    $("#total-categories").textContent=categories.length;
    $("#active-categories").textContent=categories.filter(c=>c.is_active).length;
    $("#assigned-products").textContent=categories.reduce((sum,c)=>sum+Number(c.product_count||0),0);
    render();$("#last-updated").textContent="Synced "+new Date().toLocaleTimeString();
  } catch(error) { $("#list-status").textContent=error.message; }
}
function openModal(category=null) {
  editingCategory=category;$("#category-form").reset();$("#form-message").textContent="";
  $("#modal-title").textContent=category?"Edit category":"Add a category";
  $("#save-category").textContent=category?"Save changes":"Save category";
  $("#category-name").value=category?.name || "";$("#category-description").value=category?.description || "";
  $("#category-modal").hidden=false;document.body.classList.add("modal-open");$("#category-name").focus();
}
function closeModal(){ $("#category-modal").hidden=true;document.body.classList.remove("modal-open");editingCategory=null; }
async function toggleStatus(category,button) {
  const next=!category.is_active;
  if(!confirm((next?"Activate ":"Deactivate ")+category.name+"?"))return;
  button.disabled=true;
  try { await api("/api/products/categories/"+encodeURIComponent(category.id)+"/status",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:next})});await load(); }
  catch(error){alert(error.message);button.disabled=false;}
}
$("#category-form").addEventListener("submit",async event=>{
  event.preventDefault();const save=$("#save-category");save.disabled=true;$("#form-message").textContent="Saving category…";
  const payload={name:$("#category-name").value.trim(),description:$("#category-description").value.trim()};
  try { await api(editingCategory?"/api/products/categories/"+encodeURIComponent(editingCategory.id):"/api/products/categories",{method:editingCategory?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});closeModal();await load(); }
  catch(error){$("#form-message").textContent=error.message;$("#form-message").className="form-message error-text";}
  finally{save.disabled=false;}
});
$("#add-category").addEventListener("click",()=>openModal());
$("#close-modal").addEventListener("click",closeModal);$("#cancel-modal").addEventListener("click",closeModal);
$("#category-modal").addEventListener("click",event=>{if(event.target===$("#category-modal"))closeModal();});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("#category-modal").hidden)closeModal();});
$("#search").addEventListener("input",render);$("#status-filter").addEventListener("change",render);$("#refresh").addEventListener("click",load);
async function logout(){try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});}finally{location.replace("/login");}}
$("#logout").addEventListener("click",logout);$("#logout-top").addEventListener("click",logout);
$("#mobile-menu").addEventListener("click",()=>$("#sidebar").classList.toggle("sidebar-open"));
(async()=>{try{await requireOwner();await load();}catch(error){console.error(error);}})();