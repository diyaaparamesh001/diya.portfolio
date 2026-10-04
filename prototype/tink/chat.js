const chat = document.querySelector(".chat");
const thread = document.getElementById("thread");
const composer = document.getElementById("composer");
const input = document.getElementById("composer-input");
const toggle = document.getElementById("composer-toggle");
const mic = document.getElementById("mic-btn");
const send = document.getElementById("send-btn");
const stop = document.getElementById("stop-btn");
const newChat = document.getElementById("new-chat-btn");

const userTemplate = document.getElementById("user-message");
const botTemplate = document.getElementById("bot-message");
const typingTemplate = document.getElementById("typing-indicator");

// Each mode has its own canned replies. "think with me" nudges the user to
// think first and takes a moment; "quick help" answers straight away.
const MODES = {
  think: {
    label: "think with me",
    delay: 3000,
    replies: [
      "Before I jump in, what’s your first thought?",
      "Let’s break it down. What do you already know about this?",
      "You might be closer than you think. What’s one possibility that comes to mind?",
    ],
  },
  quick: {
    label: "quick help",
    delay: 0,
    dailyLimit: 5,
    replies: [
      "The Nile is traditionally considered the longest river in the world, flowing through northeastern Africa and several countries.",
      "8 × 2 = 16. Multiplying 8 by 2 means adding 8 twice: 8 + 8 = 16.",
      "Newton’s second law states that force equals mass multiplied by acceleration. It is represented by the formula F = ma.",
    ],
  },
};

let mode = MODES.think;

// The quick help allowance is set on the settings screen.
try {
  const saved = JSON.parse(localStorage.getItem("tink:settings"));
  if (saved && saved.quickPerDay >= 1) MODES.quick.dailyLimit = saved.quickPerDay;
} catch {
  // keep the default
}

// --- Quick help daily limit ------------------------------------------------
//
// Counted per day in this browser. Storage can be unavailable (private
// mode, blocked site data), in which case the count lasts for the page.

const QUOTA_KEY = "tink:quickHelpQuota";
const limitNotice = document.getElementById("limit-notice");
let quota = loadQuota();

function today() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
}

function loadQuota() {
  try {
    const saved = JSON.parse(localStorage.getItem(QUOTA_KEY));
    if (saved && saved.date === today()) return saved;
  } catch {
    // fall through to a fresh count
  }
  return { date: today(), count: 0 };
}

function useQuota() {
  if (quota.date !== today()) quota = { date: today(), count: 0 };
  quota.count += 1;
  try {
    localStorage.setItem(QUOTA_KEY, JSON.stringify(quota));
  } catch {
    // count still applies for this page
  }
}

// False (and shows the notice) when the current mode is out of replies today.
function canReply() {
  if (!mode.dailyLimit) return true;
  if (quota.date !== today()) quota = { date: today(), count: 0 };
  const allowed = quota.count < mode.dailyLimit;
  limitNotice.hidden = allowed;
  if (!allowed) scrollToEnd(); // keep the last reply in view above the notice
  return allowed;
}

let lastReply = null;
let pending = null; // { timer, typing } while tink is "thinking"

// --- Composer ------------------------------------------------------------

// The "more" button spreads the button pair into a chat box, and collapses
// it back when pressed again (or on Escape).
function setOpen(open) {
  composer.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close chat box" : "Open chat box");
  mic.tabIndex = open ? -1 : 0;
  input.tabIndex = open ? 0 : -1;
  syncButtons();
  if (open) {
    input.focus({ preventScroll: true });
  } else {
    input.blur();
  }
}

// Only the button currently shown in the box is reachable by keyboard.
function syncButtons() {
  const open = composer.classList.contains("is-open");
  const waiting = composer.classList.contains("is-waiting");
  const hasText = composer.classList.contains("has-text");
  send.tabIndex = open && hasText && !waiting ? 0 : -1;
  stop.tabIndex = open && waiting ? 0 : -1;
}

function setState(name, on) {
  composer.classList.toggle(name, on);
  syncButtons();
}

toggle.addEventListener("click", () => setOpen(!composer.classList.contains("is-open")));

input.addEventListener("input", () => setState("has-text", input.value.trim() !== ""));

input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setOpen(false);
    toggle.focus();
  }
});

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || pending || !canReply()) return;

  input.value = "";
  setState("has-text", false);
  addUserMessage(text);
  queueReply();
  input.focus({ preventScroll: true });
});

stop.addEventListener("click", () => {
  cancelReply();
  input.focus({ preventScroll: true });
});

// --- Conversation --------------------------------------------------------
//
// Chats are kept in this browser so they show up under "recent" in the
// side menu. Storage can be unavailable, in which case they last for the
// page only.

const CHATS_KEY = "tink:chats";
let chats = loadChats(); // newest first: { id, title, updated, messages: [{ role, text, time }] }
let current = null; // the open chat, or null for a fresh, empty one

function loadChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHATS_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // start with no history
  }
  return [];
}

function saveChats() {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  } catch {
    // history still lasts for this page
  }
}

// Move a chat to the top of the recent list after new activity.
function touch(chatItem) {
  chatItem.updated = Date.now();
  chats = [chatItem, ...chats.filter((item) => item !== chatItem)];
  saveChats();
}

function showThread(show) {
  thread.hidden = !show;
  chat.classList.toggle("has-thread", show);
}

function clearThread() {
  thread.querySelectorAll(".msg, .typing").forEach((node) => node.remove());
}

// Leave whatever is open: finish a reply that is on its way (so it's saved
// with its chat), and reset the dock.
function leaveChat() {
  flushPending();
  stopVoice();
  lastReply = null;
  limitNotice.hidden = true;
  input.value = "";
  setState("has-text", false);
  setOpen(false);
}

// Top-right button: start a fresh chat; the old one stays in the history.
function startNewChat() {
  leaveChat();
  current = null;
  clearThread();
  showThread(false);
}

function openChat(chatItem) {
  leaveChat();
  current = chatItem;
  clearThread();
  chatItem.messages.forEach((message, index) => {
    thread.append(message.role === "user" ? renderUser(message) : renderBot(message, index));
  });
  showThread(true);
  scrollToEnd();
}

newChat.addEventListener("click", startNewChat);

function scrollToEnd() {
  thread.scrollTop = thread.scrollHeight;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function renderUser(message) {
  const node = userTemplate.content.firstElementChild.cloneNode(true);
  const date = new Date(message.time);
  node.querySelector(".msg__bubble").textContent = message.text;
  const time = node.querySelector(".msg__time");
  time.textContent = formatTime(date);
  time.dateTime = date.toISOString();
  return node;
}

function renderBot(message, index) {
  const node = botTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".msg__text").textContent = message.text;
  node.dataset.index = String(index);
  return node;
}

function addUserMessage(text) {
  if (!current) {
    current = { id: String(Date.now()), title: text, updated: Date.now(), messages: [] };
  }
  const message = { role: "user", text, time: Date.now() };
  current.messages.push(message);
  touch(current);
  thread.append(renderUser(message));
  showThread(true);
  scrollToEnd();
}

// Random reply, never the same one twice in a row.
function pickReply(replyMode) {
  const options = replyMode.replies.filter((reply) => reply !== lastReply);
  lastReply = options[Math.floor(Math.random() * options.length)];
  return lastReply;
}

// Show the typing dots for the mode's delay, then swap them for tink's
// reply; with no delay the reply appears straight away.
// `replaceNode` is set when regenerating an existing reply in place.
function queueReply(replaceNode = null) {
  const replyMode = mode; // switching modes mid-reply doesn't change this one
  const replyChat = current;
  const replaceIndex = replaceNode ? Number(replaceNode.dataset.index) : null;
  if (replyMode.dailyLimit) useQuota();

  // Saves the reply into its chat and returns the rendered message.
  const commit = () => {
    const message = { role: "bot", text: pickReply(replyMode), time: Date.now() };
    let index = replaceIndex;
    if (index === null) {
      index = replyChat.messages.push(message) - 1;
    } else {
      replyChat.messages[index] = message;
    }
    touch(replyChat);
    return renderBot(message, index);
  };

  if (!replyMode.delay) {
    const reply = commit();
    if (replaceNode) {
      replaceNode.replaceWith(reply);
    } else {
      thread.append(reply);
    }
    scrollToEnd();
    return;
  }

  const typing = typingTemplate.content.firstElementChild.cloneNode(true);
  if (replaceNode) {
    replaceNode.replaceWith(typing);
  } else {
    thread.append(typing);
  }
  scrollToEnd();
  setState("is-waiting", true);

  const timer = setTimeout(() => {
    typing.replaceWith(commit());
    pending = null;
    setState("is-waiting", false);
    scrollToEnd();
  }, replyMode.delay);

  pending = { timer, typing, commit };
}

// Stop button: drop the reply that is on its way.
function cancelReply() {
  if (!pending) return;
  clearTimeout(pending.timer);
  pending.typing.remove();
  pending = null;
  setState("is-waiting", false);
}

// Leaving a chat mid-reply: save the reply now instead of dropping it.
function flushPending() {
  if (!pending) return;
  clearTimeout(pending.timer);
  pending.commit();
  pending.typing.remove();
  pending = null;
  setState("is-waiting", false);
}

thread.addEventListener("click", async (event) => {
  const button = event.target.closest(".msg__action");
  if (!button) return;
  const message = button.closest(".msg--bot");

  if (button.dataset.action === "copy") {
    try {
      await navigator.clipboard.writeText(message.querySelector(".msg__text").textContent);
      button.classList.add("is-done");
      setTimeout(() => button.classList.remove("is-done"), 1200);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context); nothing to do.
    }
  } else if (button.dataset.action === "regenerate" && !pending && canReply()) {
    queueReply(message);
  }
});

// --- Mode menu -----------------------------------------------------------

const modePicker = document.getElementById("mode-picker");
const modeLabel = document.getElementById("mode-label");
const modeMenu = document.getElementById("mode-menu");
const modeItems = [...modeMenu.querySelectorAll(".mode-menu__item")];
const scrim = document.getElementById("scrim");

function setMenuOpen(open) {
  modeMenu.hidden = !open;
  scrim.hidden = !open;
  modePicker.setAttribute("aria-expanded", String(open));
  if (open) {
    (modeItems.find((item) => item.getAttribute("aria-checked") === "true") || modeItems[0]).focus();
  }
}

function setMode(key) {
  mode = MODES[key];
  if (!mode.dailyLimit) limitNotice.hidden = true;
  modeLabel.textContent = mode.label;
  modeItems.forEach((item) => item.setAttribute("aria-checked", String(item.dataset.mode === key)));
}

modePicker.addEventListener("click", () => setMenuOpen(modeMenu.hidden));
scrim.addEventListener("click", closeOverlays);

modeMenu.addEventListener("click", (event) => {
  const item = event.target.closest(".mode-menu__item");
  if (!item) return;
  setMode(item.dataset.mode);
  setMenuOpen(false);
  modePicker.focus();
});

modeMenu.addEventListener("keydown", (event) => {
  const index = modeItems.indexOf(document.activeElement);
  if (event.key === "Escape") {
    setMenuOpen(false);
    modePicker.focus();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    modeItems[(index + step + modeItems.length) % modeItems.length].focus();
  }
});

// --- Side menu -----------------------------------------------------------

const drawer = document.getElementById("drawer");
const drawerOpen = document.getElementById("drawer-open");
const drawerClose = document.getElementById("drawer-close");
const recentList = document.getElementById("recent-list");
const recentEmpty = document.getElementById("recent-empty");
const accountBtn = document.getElementById("account-btn");
const accountMenu = document.getElementById("account-menu");
const accountItems = [...accountMenu.querySelectorAll(".account-menu__item")];

// "now", "5 min ago", "14:32" (today), "yesterday", or a date.
function formatWhen(time) {
  const date = new Date(time);
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min ago`;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  if (date >= dayStart) return formatTime(date);
  if (date >= dayStart - 86400000) return "yesterday";
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function renderRecent() {
  recentList.replaceChildren(
    ...chats.map((item) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recent__item";
      button.dataset.id = item.id;
      if (item === current) button.setAttribute("aria-current", "true");
      const title = document.createElement("span");
      title.className = "recent__title";
      title.textContent = item.title;
      const when = document.createElement("span");
      when.className = "recent__when";
      when.textContent = formatWhen(item.updated);
      button.append(title, when);
      li.className = "recent__row";
      li.append(deleteButton(item), button);
      return li;
    })
  );
  recentEmpty.hidden = chats.length > 0;
  recentList.hidden = chats.length === 0;
  updateRecentHint();
}

function deleteButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "recent__delete";
  button.dataset.id = item.id;
  button.tabIndex = -1;
  button.setAttribute("aria-label", `Delete chat: ${item.title}`);
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M10 11v6m4-6v6M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12M9.5 7V4.5h5V7" /></svg>delete';
  return button;
}

// "slide a chat to the right to delete it" sits under the last chat, but
// only while the chats haven't filled the list yet.
function updateRecentHint() {
  recentList.querySelector(".recent__hint")?.remove();
  if (!chats.length) return;
  const hint = document.createElement("li");
  hint.className = "recent__hint";
  hint.setAttribute("aria-hidden", "true");
  hint.textContent = "slide a chat to the right to delete it";
  recentList.append(hint);
  if (recentList.scrollHeight > recentList.clientHeight) hint.remove();
}

function deleteChat(id) {
  const item = chats.find((entry) => entry.id === id);
  if (!item) return;
  chats = chats.filter((entry) => entry !== item);
  saveChats();
  if (item === current) startNewChat();

  const row = recentList.querySelector(`.recent__item[data-id="${CSS.escape(id)}"]`)?.closest(".recent__row");
  if (!row) return renderRecent();
  row.style.height = `${row.offsetHeight}px`;
  requestAnimationFrame(() => {
    row.classList.add("is-removing");
    row.style.height = "0px";
  });
  setTimeout(renderRecent, 240);
}

function setDrawerOpen(open) {
  if (open) {
    setMenuOpen(false);
    renderRecent();
  } else {
    setAccountOpen(false);
  }
  drawer.classList.toggle("is-open", open);
  drawer.inert = !open;
  if (!open) openRow = null;
  scrim.hidden = !open;
  drawerOpen.setAttribute("aria-expanded", String(open));
  (open ? drawerClose : drawerOpen).focus({ preventScroll: true });
}

function setAccountOpen(open) {
  accountMenu.hidden = !open;
  accountBtn.classList.toggle("is-open", open);
  accountBtn.setAttribute("aria-expanded", String(open));
}

function closeOverlays() {
  if (drawer.classList.contains("is-open")) {
    setDrawerOpen(false);
  } else {
    setMenuOpen(false);
  }
}

drawer.inert = true;

// Guests (who came in through "try first") get an "exit guest mode" button,
// back to the homescreen, in place of the account button.
let signedIn = false;
try {
  signedIn = localStorage.getItem("tink:signedIn") === "true";
} catch {
  // treat as a guest
}
document.querySelector(".account:not(.account--guest)").hidden = !signedIn;
document.getElementById("guest-login").hidden = signedIn;
drawerOpen.addEventListener("click", () => setDrawerOpen(true));
drawerClose.addEventListener("click", () => setDrawerOpen(false));

// --- Swipe a chat right to delete it ----------------------------------------

let swipe = null; // the drag in progress
let openRow = null; // the chat currently slid open
let suppressClick = false; // a drag just ended; ignore its click

function revealWidth(item) {
  return item.parentElement.querySelector(".recent__delete").offsetWidth;
}

function setRowOffset(item, offset) {
  item.style.transform = offset ? `translateX(${offset}px)` : "";
  const row = item.parentElement;
  clearTimeout(row.hideTimer);
  if (offset) {
    row.classList.add("is-revealed");
  } else {
    // keep the button visible while the row slides shut
    row.hideTimer = setTimeout(() => row.classList.remove("is-revealed"), 240);
  }
}

function closeOpenRow() {
  if (!openRow) return;
  setRowOffset(openRow, 0);
  openRow.parentElement.querySelector(".recent__delete").tabIndex = -1;
  openRow = null;
}

recentList.addEventListener("pointerdown", (event) => {
  const item = event.target.closest(".recent__item");
  if (!item || event.button > 0) return;
  swipe = {
    item,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    base: item === openRow ? revealWidth(item) : 0,
    dragging: false,
  };
});

recentList.addEventListener("pointermove", (event) => {
  if (!swipe || event.pointerId !== swipe.pointerId) return;
  const dx = event.clientX - swipe.startX;
  const dy = event.clientY - swipe.startY;
  if (!swipe.dragging) {
    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
      swipe = null; // a vertical scroll, not a swipe
      return;
    }
    if (Math.abs(dx) < 6) return;
    swipe.dragging = true;
    swipe.item.classList.add("is-dragging");
    swipe.item.setPointerCapture(event.pointerId);
    swipe.item.parentElement.classList.add("is-revealed");
    if (openRow && openRow !== swipe.item) closeOpenRow();
  }
  const max = revealWidth(swipe.item);
  let offset = swipe.base + dx;
  if (offset > max) offset = max + (offset - max) * 0.25; // a little give past the button
  setRowOffset(swipe.item, Math.max(0, offset));
});

function endSwipe(event) {
  if (!swipe || event.pointerId !== swipe.pointerId) return;
  const { item, dragging, base, startX } = swipe;
  swipe = null;
  if (!dragging) return;
  item.classList.remove("is-dragging");
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 0);
  const offset = base + (event.clientX - startX);
  if (offset > revealWidth(item) / 2) {
    setRowOffset(item, revealWidth(item));
    openRow = item;
    item.parentElement.querySelector(".recent__delete").tabIndex = 0;
  } else {
    setRowOffset(item, 0);
    if (openRow === item) openRow = null;
  }
}

recentList.addEventListener("pointerup", endSwipe);
recentList.addEventListener("pointercancel", endSwipe);

recentList.addEventListener("click", (event) => {
  if (suppressClick) return;

  const del = event.target.closest(".recent__delete");
  if (del) {
    openRow = null;
    deleteChat(del.dataset.id);
    return;
  }

  const button = event.target.closest(".recent__item");
  if (!button) return;
  if (openRow) {
    closeOpenRow(); // a tap on a slid-open chat just closes it
    return;
  }
  const item = chats.find((entry) => entry.id === button.dataset.id);
  if (item && item !== current) openChat(item);
  setDrawerOpen(false);
});

accountBtn.addEventListener("click", () => setAccountOpen(accountMenu.hidden));

accountMenu.addEventListener("click", (event) => {
  const item = event.target.closest(".account-menu__item");
  if (!item) return;
  setAccountOpen(false);
  switch (item.dataset.action) {
    case "profile":
      rememberSession();
      window.location.href = "profile.html";
      break;
    case "modes":
      rememberSession();
      window.location.href = "modes.html";
      break;
    case "logout":
      try {
        localStorage.removeItem("tink:signedIn");
      } catch {
        // nothing stored
      }
      window.location.href = "home.html";
      break;
    case "settings":
      rememberSession();
      window.location.href = "settings.html";
      break;
    default:
      break;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !drawer.classList.contains("is-open")) return;
  if (!accountMenu.hidden) {
    setAccountOpen(false);
    accountBtn.focus();
  } else {
    setDrawerOpen(false);
  }
});

accountMenu.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const index = accountItems.indexOf(document.activeElement);
  const step = event.key === "ArrowDown" ? 1 : -1;
  accountItems[(index + step + accountItems.length) % accountItems.length].focus();
});

// --- Voice ---------------------------------------------------------------
//
// The mic button swaps the dock for a blue ball. While the user speaks the
// ball glows with their voice level; once they stop, what they said goes in
// as a message and tink replies the same way it does to typed text. Tapping
// the ball leaves voice mode.
//
// Speech is detected from the microphone level. When the browser can also
// transcribe (Web Speech API), the transcript becomes the message text.
// Without microphone access the ball works as hold-to-talk instead.

const voice = document.getElementById("voice");
const ball = document.getElementById("voice-ball");
const voiceHint = document.getElementById("voice-hint");

const SPEAKING_THRESHOLD = 0.035; // RMS level that counts as speech
const SILENCE_MS = 1200; // quiet time that ends an utterance
const HOLD_MS = 250; // hold-to-talk: shorter presses count as a tap

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let voiceSession = null;

function setSpeaking(on, level = 0) {
  voice.classList.toggle("is-speaking", on);
  voice.style.setProperty("--level", on ? level.toFixed(2) : "0");
}

async function startVoice() {
  if (voiceSession) return;
  setOpen(false);
  chat.classList.add("is-voice");
  voice.hidden = false;
  ball.focus({ preventScroll: true });

  const session = { heard: false, lastSound: 0, transcript: "", frame: 0 };
  voiceSession = session;

  try {
    session.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    session.holdToTalk = true;
    showVoiceHintOnce();
    return;
  }
  if (voiceSession !== session) {
    session.stream.getTracks().forEach((track) => track.stop());
    return;
  }

  session.audio = new AudioContext();
  const analyser = session.audio.createAnalyser();
  analyser.fftSize = 1024;
  session.audio.createMediaStreamSource(session.stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.addEventListener("result", (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal && !pending) {
          session.transcript += event.results[i][0].transcript;
        }
      }
    });
    // Chrome ends recognition after a while; keep it going in voice mode.
    recognition.addEventListener("end", () => {
      if (voiceSession === session) {
        try { recognition.start(); } catch { /* already started */ }
      }
    });
    try { recognition.start(); } catch { /* not allowed here */ }
    session.recognition = recognition;
  }

  const tick = () => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const rms = Math.sqrt(sum / samples.length);
    const now = performance.now();

    // Ignore the mic while tink is thinking.
    if (!pending && rms > SPEAKING_THRESHOLD) {
      session.heard = true;
      session.lastSound = now;
      setSpeaking(true, Math.min(1, rms * 8));
    } else if (session.heard && now - session.lastSound > SILENCE_MS) {
      finishUtterance(session);
    } else if (!session.heard || now - session.lastSound > 150) {
      setSpeaking(false);
    }
    session.frame = requestAnimationFrame(tick);
  };
  tick();
}

// The user stopped talking: post what they said and let tink reply.
function finishUtterance(session) {
  session.heard = false;
  setSpeaking(false);
  if (pending || !canReply()) return;
  // Give the recogniser a moment to deliver the final transcript.
  setTimeout(() => {
    if (voiceSession !== session || pending) return;
    const text = session.transcript.trim() || "🎙 voice message";
    session.transcript = "";
    addUserMessage(text);
    queueReply();
  }, session.recognition ? 600 : 0);
}

// "hold the ball and talk · tap to exit" is shown the first time only.
const VOICE_HINT_KEY = "tink:voiceHintSeen";
let voiceHintSeen = false;

function showVoiceHintOnce() {
  try {
    voiceHintSeen = voiceHintSeen || localStorage.getItem(VOICE_HINT_KEY) === "true";
    localStorage.setItem(VOICE_HINT_KEY, "true");
  } catch {
    // without storage it still shows only once per visit
  }
  if (voiceHintSeen) return;
  voiceHintSeen = true;
  voiceHint.hidden = false;
}

function stopVoice() {
  const session = voiceSession;
  if (!session) return;
  voiceSession = null;
  cancelAnimationFrame(session.frame);
  session.recognition?.abort();
  session.stream?.getTracks().forEach((track) => track.stop());
  session.audio?.close();
  setSpeaking(false);
  voiceHint.hidden = true;
  voice.hidden = true;
  chat.classList.remove("is-voice");
}

mic.addEventListener("click", startVoice);

// Tap the ball to leave voice mode. In hold-to-talk mode, a long press is
// speech instead: the ball glows while held and releasing sends it.
let holdStart = 0;
let holdTimer = 0;
let holdPulse = 0;

ball.addEventListener("pointerdown", (event) => {
  if (!voiceSession?.holdToTalk || pending) return;
  ball.setPointerCapture(event.pointerId);
  holdStart = performance.now();
  holdTimer = setTimeout(() => {
    const pulse = () => {
      setSpeaking(true, 0.5 + 0.5 * Math.sin(performance.now() / 180));
      holdPulse = requestAnimationFrame(pulse);
    };
    pulse();
  }, HOLD_MS);
});

ball.addEventListener("pointerup", () => {
  clearTimeout(holdTimer);
  cancelAnimationFrame(holdPulse);
  if (holdStart && performance.now() - holdStart >= HOLD_MS) {
    holdStart = 0;
    setSpeaking(false);
    finishUtterance(voiceSession);
    ball.dataset.held = "true"; // swallow the click that follows
  }
  holdStart = 0;
});

ball.addEventListener("click", () => {
  if (ball.dataset.held) {
    delete ball.dataset.held;
    return;
  }
  stopVoice();
  mic.focus({ preventScroll: true });
});

// --- Returning from another screen -----------------------------------------
//
// Profile and modes are separate screens. Their back buttons return to
// chat.html?drawer=1, which reopens the chat and mode the user left with the
// side menu already open.

const SESSION_KEY = "tink:session";

function rememberSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      chatId: current ? current.id : null,
      mode: Object.keys(MODES).find((key) => MODES[key] === mode),
    }));
  } catch {
    // without storage the user just comes back to a fresh chat
  }
}

function restoreSession() {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return;
  }
  if (!saved) return;
  if (MODES[saved.mode]) setMode(saved.mode);
  const item = chats.find((entry) => entry.id === saved.chatId);
  if (item) openChat(item);
}

if (new URLSearchParams(location.search).get("drawer") === "1") {
  restoreSession();
  drawer.classList.add("no-anim");
  setDrawerOpen(true);
  requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.remove("no-anim")));
  history.replaceState(null, "", "chat.html");
}
