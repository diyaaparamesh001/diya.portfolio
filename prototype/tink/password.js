const form = document.getElementById("pw-form");
const error = document.getElementById("pw-error");
const current = document.getElementById("current-password");
const next = document.getElementById("new-password");
const confirm = document.getElementById("confirm-password");

// Eye buttons: closed eye while hidden, open eye while visible.
document.querySelectorAll("[data-toggle]").forEach((button) => {
  const input = document.getElementById(button.dataset.toggle);
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
});

function showError(message, input) {
  document.querySelectorAll(".field.is-invalid").forEach((field) => field.classList.remove("is-invalid"));
  error.textContent = message;
  error.hidden = !message;
  if (input) {
    input.closest(".field").classList.add("is-invalid");
    input.focus();
  }
}

// Confirmation notification: slides up, then fades after a moment.
const toast = document.getElementById("toast");
let toastTimer = 0;

function showToast(message, duration = 2200) {
  document.getElementById("toast-text").textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), duration);
}

form.addEventListener("input", () => showError(""));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!current.value) return showError("please enter your current password", current);
  if (!next.value) return showError("please enter a new password", next);
  if (next.value !== confirm.value) return showError("the new passwords don’t match", confirm);
  // TODO: update the password with the backend.
  form.querySelectorAll("input").forEach((input) => (input.disabled = true));
  document.querySelector(".pw__submit").disabled = true;
  showToast("your password has been updated", 1600);
  setTimeout(() => (window.location.href = "profile.html"), 1900);
});
