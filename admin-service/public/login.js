const form = document.querySelector("#login-form");
const message = document.querySelector("#message");

async function currentUser() {
  const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json();
  return data.user || null;
}

function isOwner(user) {
  return user && user.role === "owner";
}

(async () => {
  try {
    const user = await currentUser();
    if (isOwner(user)) location.replace("/dashboard");
  } catch {
    // The login form will show a useful error when submitted if the API is unavailable.
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Signing in…";
  message.className = "message";
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username.value.trim(),
        password: form.password.value
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to sign in.");
    if (!isOwner(data.user)) {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      throw new Error("This admin portal is restricted to the owner account.");
    }
    location.replace("/dashboard");
  } catch (error) {
    message.textContent = error.message || "Sign-in failed. Please try again.";
    message.className = "message error";
  } finally {
    button.disabled = false;
  }
});
