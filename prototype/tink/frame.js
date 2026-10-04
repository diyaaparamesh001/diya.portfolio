// Every screen is designed for a fixed 375 x 812 phone screen and is shown
// inside the phone shell (index.html). Opened on its own, a screen reloads
// itself inside the shell so it always renders at its design size.
if (!(window.frameElement && window.frameElement.hasAttribute("data-phone-screen"))) {
  const screen = location.pathname.split("/").pop() || "home.html";
  location.replace("index.html?screen=" + encodeURIComponent(screen));
}
