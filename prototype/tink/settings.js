// Settings are kept in this browser. quickPerDay is read by the chat screen
// as the quick help daily limit.
const SETTINGS_KEY = "tink:settings";
const DEFAULTS = {
  webAccess: true,
  emotionalDependence: true,
  limitPersonalData: true,
  dailyLimit: 30, // minutes
  quickPerDay: 5,
};

let settings = { ...DEFAULTS };
try {
  settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
} catch {
  // defaults
}

function save() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // settings last for this page only
  }
}

// --- Switches --------------------------------------------------------------

document.querySelectorAll(".switch").forEach((toggle) => {
  const key = toggle.dataset.setting;
  toggle.setAttribute("aria-checked", String(Boolean(settings[key])));
  toggle.addEventListener("click", () => {
    settings[key] = toggle.getAttribute("aria-checked") !== "true";
    toggle.setAttribute("aria-checked", String(settings[key]));
    save();
  });
});

// --- Pickers ---------------------------------------------------------------

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} mins`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

const PICKERS = {
  dailyLimit: [30, ...Array.from({ length: 15 }, (_, i) => (i + 1) * 60)].map((m) => [m, formatMinutes(m)]),
  quickPerDay: Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)]),
};

document.querySelectorAll("select[data-setting]").forEach((select) => {
  const key = select.dataset.setting;
  const label = document.querySelector(`[data-pill-for="${select.id}"]`);
  for (const [value, text] of PICKERS[key]) {
    select.add(new Option(text, String(value), false, value === settings[key]));
  }
  const sync = () => {
    label.textContent = select.selectedOptions[0].textContent;
  };
  sync();
  select.addEventListener("change", () => {
    settings[key] = Number(select.value);
    save();
    sync();
  });
});

// --- Conversations ---------------------------------------------------------

document.getElementById("export-btn").addEventListener("click", () => {
  // TODO: export conversations.
});


// Confirmation notification: slides up, then fades after a moment.
const toast = document.getElementById("toast");
let toastTimer = 0;

function showToast(message, duration = 2200) {
  document.getElementById("toast-text").textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), duration);
}

// Clearing asks "are you sure?" first, since it can't be undone.
const clearBtn = document.getElementById("clear-btn");
const clearDialog = document.getElementById("clear-dialog");

function setDialogOpen(open) {
  clearDialog.hidden = !open;
  if (open) {
    clearDialog.querySelector(".dialog__btn--cancel").focus();
  } else {
    clearBtn.focus();
  }
}

clearBtn.addEventListener("click", () => setDialogOpen(true));

clearDialog.addEventListener("click", (event) => {
  if (event.target.closest("[data-dismiss]")) setDialogOpen(false);
});

clearDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setDialogOpen(false);
});

document.getElementById("clear-confirm").addEventListener("click", () => {
  setDialogOpen(false);
  try {
    localStorage.removeItem("tink:chats");
    const session = JSON.parse(sessionStorage.getItem("tink:session"));
    if (session) sessionStorage.setItem("tink:session", JSON.stringify({ ...session, chatId: null }));
  } catch {
    // nothing stored
  }
  showToast("all conversations cleared");
});
