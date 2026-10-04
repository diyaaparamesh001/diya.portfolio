const form = document.getElementById("login-form");
const email = document.getElementById("email");
const editEmail = document.getElementById("edit-email");
const password = document.getElementById("password");
const passwordField = document.getElementById("password-field");
const passwordError = document.getElementById("password-error");
const togglePassword = document.getElementById("toggle-password");

// "edit" unlocks the email field; "save" (or Enter) locks it again.
function setEmailEditing(editing) {
  email.readOnly = !editing;
  editEmail.textContent = editing ? "save" : "edit";
  if (editing) {
    email.focus();
    email.setSelectionRange(email.value.length, email.value.length);
  }
}

editEmail.addEventListener("click", () => setEmailEditing(email.readOnly));

email.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    setEmailEditing(false);
    password.focus();
  }
});

togglePassword.addEventListener("click", () => {
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  togglePassword.setAttribute("aria-pressed", String(show));
  togglePassword.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

password.addEventListener("input", () => {
  passwordField.classList.remove("is-invalid");
  passwordError.hidden = true;
});

document.getElementById("forgot-password").addEventListener("click", (event) => {
  event.preventDefault();
  // TODO: route to the forgot password flow.
  console.log("Forgot password clicked");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!password.value) {
    passwordField.classList.add("is-invalid");
    passwordError.hidden = false;
    password.focus();
    return;
  }
  // TODO: authenticate with the backend before moving on.
  try {
    localStorage.setItem("tink:signedIn", "true");
  } catch {
    // the chat will treat the user as a guest
  }
  window.location.href = "chat.html";
});
