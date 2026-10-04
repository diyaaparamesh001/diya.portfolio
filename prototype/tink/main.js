// Apple sign-in opens in a popup that is closed after 5 seconds, returning
// the user to this page. A page can't redirect itself back from another
// site, so the popup is the only way to guarantee the return trip.
const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_RETURN_MS = 5000;

// "try first" enters the app as a guest.
document.getElementById("try-first").addEventListener("click", () => {
  try {
    localStorage.removeItem("tink:signedIn");
  } catch {
    // nothing stored
  }
});

document.getElementById("apple-btn").addEventListener("click", (event) => {
  event.preventDefault();

  const width = 500;
  const height = 650;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popup = window.open(
    APPLE_AUTH_URL,
    "apple-signin",
    `popup,width=${width},height=${height},left=${left},top=${top}`
  );

  if (!popup) {
    // Popup blocked: fall back to a normal navigation (no auto-return possible).
    window.top.location.href = APPLE_AUTH_URL;
    return;
  }

  setTimeout(() => {
    if (!popup.closed) popup.close();
    window.focus();
  }, APPLE_RETURN_MS);
});
