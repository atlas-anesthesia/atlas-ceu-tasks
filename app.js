// =====================================================================
// atlas ceu tasks · oliver, josh & dev
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch, getDocs, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getMessaging, getToken, onMessage, isSupported as messagingIsSupported,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// 1. firebase config — atlas-ceu-tasks project
const firebaseConfig = {
  apiKey: "AIzaSyAU0xEZuPCv0Nq3C309XO1lpzSmpccYHDE",
  authDomain: "atlas-ceu-tasks.firebaseapp.com",
  projectId: "atlas-ceu-tasks",
  storageBucket: "atlas-ceu-tasks.firebasestorage.app",
  messagingSenderId: "1066045029366",
  appId: "1:1066045029366:web:c33f3d5f4a1e755d8325d7",
  measurementId: "G-Z0WPBDDY3F",
};

// 2. tags
const TAGS = {
  "marketing":     { label: "marketing",     color: "blue" },
  "content":       { label: "content",       color: "purple" },
  "social-media":  { label: "social media",  color: "green" },
  "partnerships":  { label: "partnerships",  color: "orange" },
};
const normalizeTagKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const TAG_LOOKUP = {};
for (const id of Object.keys(TAGS)) {
  TAG_LOOKUP[normalizeTagKey(id)] = id;
  TAG_LOOKUP[normalizeTagKey(TAGS[id].label)] = id;
}

// 3. init firebase
let db, firebaseReady = false;
let firebaseApp = null;
try {
  firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
  firebaseReady = true;
} catch (err) { console.error("firebase init failed:", err); }
const tasksCol = firebaseReady ? collection(db, "tasks") : null;
const fcmTokensCol = firebaseReady ? collection(db, "fcm_tokens") : null;

// VAPID key for web push (from Firebase Console > Cloud Messaging > Web Push certificates)
const VAPID_KEY = "BINq6gHunbhR6ec9FQ4RQZCYEscebN-T8ANUODc3GKi3awPXxzNQuSu2moLoM75w4shzArDeCvFouDiTsHY5kZA";

// 4. dom
const $ = (sel) => document.querySelector(sel);
const oliverList = $("#oliverList");
const joshList = $("#joshList");
const devList = $("#devList");
const oliverCount = $("#oliverCount");
const joshCount = $("#joshCount");
const devCount = $("#devCount");
// per-person DOM lookups, keyed by person id (keeps the 3-person code generic)
const LIST_EL = { oliver: oliverList, josh: joshList, dev: devList };
const COUNT_EL = { oliver: oliverCount, josh: joshCount, dev: devCount };
const quickInput = $("#quickInput");
const quickStatus = $("#quickStatus");
const addBtn = $("#addBtn");
const syncStatus = $("#syncStatus");
const syncPill = $("#syncPill");
const clearDoneBtn = $("#clearDoneBtn");
const heroDate = $("#heroDate");
const sortModeSel = $("#sortMode");
const filterTagSel = $("#filterTag");
const dateModal = $("#dateModal");
const dateModalInput = $("#dateModalInput");
const dateModalTimeInput = $("#dateModalTimeInput");
const dateModalClose = $("#dateModalClose");
const dateModalBackdrop = $("#dateModalBackdrop");
const dateModalDone = $("#dateModalDone");
const dateModalClear = $("#dateModalClear");
const dateQuickRow = $("#dateQuickRow");
const dateDayRow = $("#dateDayRow");
const mePill = $("#mePill");
const meLabel = $("#meLabel");
const notifBanner = $("#newTasksBanner");
const notifText = $("#newTasksText");
const notifDismiss = $("#newTasksDismiss");
const todayPanel = $("#todayPanel");
const todayList = $("#todayList");
const todayCount = $("#todayCount");
const identityModal = $("#identityModal");
const identityModalGreeting = $("#identityModalGreeting");
const mergeBar = $("#mergeBar");
const mergeBarTarget = $("#mergeBarTarget");
const mergeBarCount = $("#mergeBarCount");
const mergeBarCancel = $("#mergeBarCancel");
const mergeBarDone = $("#mergeBarDone");
const viewList = $("#viewList");
const viewCalendar = $("#viewCalendar");
const viewIdeas = $("#viewIdeas");
const viewTabs = document.querySelectorAll(".view-tab");
const ideaForm = $("#ideaForm");
const ideaInput = $("#ideaInput");
const ideasGrid = $("#ideasGrid");
const ideasFilter = $("#ideasFilter");
const ideasEmpty = $("#ideasEmpty");
const calGrid = $("#calGrid");
const calMonthLabel = $("#calMonthLabel");
const calPrev = $("#calPrev");
const calNext = $("#calNext");
const calToday = $("#calToday");
const addMeetingBtn = $("#addMeetingBtn");
const calDayDetail = $("#calDayDetail");
const calDetailTitle = $("#calDetailTitle");
const calDetailBody = $("#calDetailBody");
const calDetailClose = $("#calDetailClose");
const calDetailBackdrop = $("#calDetailBackdrop");
const meetingModal = $("#meetingModal");
const meetingModalBackdrop = $("#meetingModalBackdrop");
const meetingModalClose = $("#meetingModalClose");
const meetingModalSave = $("#meetingModalSave");
const meetingModalDelete = $("#meetingModalDelete");
const meetingModalTitle = $("#meetingModalTitle");
const meetingTitleInput = $("#meetingTitle");
const meetingDateInput = $("#meetingDate");
const meetingTimeInput = $("#meetingTime");
const meetingLocationInput = $("#meetingLocation");
const meetingWhoBtns = document.querySelectorAll(".meeting-who-opt");
const meetingDurationInput = $("#meetingDuration");
const seqModal = $("#seqModal");
const seqModalBackdrop = $("#seqModalBackdrop");
const seqModalClose = $("#seqModalClose");
const seqModalSave = $("#seqModalSave");
const seqModalClear = $("#seqModalClear");
const seqModalTaskText = $("#seqModalTaskText");
const seqList = $("#seqList");
const seqAddStep = $("#seqAddStep");

// 5. state
let tasks = [];
const PEOPLE = ["oliver", "josh", "dev"];
const getPref = (k, fallback) => localStorage.getItem(k) || fallback;
const setPref = (k, v) => localStorage.setItem(k, v);

let sortMode = getPref("sortMode", "tag");
let filterTag = getPref("filterTag", "");
sortModeSel.value = sortMode;

let me = getPref("me", "oliver");
if (!PEOPLE.includes(me)) me = "oliver";

function buildFilterOptions() {
  filterTagSel.innerHTML = '<option value="">all tags</option>';
  for (const id of Object.keys(TAGS)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = TAGS[id].label;
    filterTagSel.appendChild(opt);
  }
  filterTagSel.value = filterTag;
}
buildFilterOptions();

// 6. identity
function updateMeUI() {
  meLabel.textContent = me;
  PEOPLE.forEach((p) => document.body.classList.remove(`me-${p}`));
  document.body.classList.add(`me-${me}`);
}
mePill.addEventListener("click", () => {
  // cycle through the people in order: oliver → josh → dev → oliver
  const idx = PEOPLE.indexOf(me);
  me = PEOPLE[(idx + 1) % PEOPLE.length];
  setPref("me", me);
  updateMeUI();
  checkForNewTasks();
});
updateMeUI();

// 6b. daily identity modal
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 4 && h < 12) return "good morning";
  if (h >= 12 && h < 17) return "good afternoon";
  if (h >= 17 && h < 21) return "good evening";
  return "hey there";
}
function showIdentityModal() {
  identityModalGreeting.textContent = getGreeting();
  identityModal.hidden = false;
  identityModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => identityModal.classList.add("open"));
}
function hideIdentityModal() {
  identityModal.classList.remove("open");
  identityModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setTimeout(() => { identityModal.hidden = true; }, 220);
}
function maybeShowIdentityModal() {
  const today = new Date().toDateString();
  if (localStorage.getItem("identityShown") !== today) {
    showIdentityModal();
  }
}
identityModal.querySelectorAll(".identity-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    const picked = btn.dataset.id;
    if (!PEOPLE.includes(picked)) return;
    me = picked;
    setPref("me", me);
    updateMeUI();
    localStorage.setItem("identityShown", new Date().toDateString());
    hideIdentityModal();
    checkForNewTasks();
  });
});

// 7. last-seen + notification
function getLastSeen() {
  const k = `lastSeen:${me}`;
  let v = localStorage.getItem(k);
  if (!v) {
    v = String(Date.now());
    localStorage.setItem(k, v);
  }
  return parseInt(v, 10);
}
function bumpLastSeen() {
  localStorage.setItem(`lastSeen:${me}`, String(Date.now()));
}
function checkForNewTasks() {
  if (!notifBanner) return;
  const since = getLastSeen();
  // anyone else (not me) who added a task assigned to me since I last looked
  const newOnes = tasks.filter((t) =>
    t.addedBy && t.addedBy !== me &&
    t.person === me &&
    (t.createdAt || 0) > since
  );
  if (newOnes.length > 0) {
    // if every new task came from the same person, name them; else say "your team"
    const adders = [...new Set(newOnes.map((t) => t.addedBy))];
    const who = adders.length === 1 ? adders[0] : "your team";
    showNotificationBanner(newOnes, who);
  } else hideNotificationBanner();
}
function showNotificationBanner(newOnes, other) {
  let text;
  if (newOnes.length === 1) {
    const t = newOnes[0].text || "a task";
    const trim = t.length > 50 ? t.slice(0, 47) + "…" : t;
    text = `${other} added "${trim}" for you`;
  } else {
    text = `${other} added ${newOnes.length} new tasks for you`;
  }
  notifText.textContent = text;
  notifBanner.hidden = false;
  requestAnimationFrame(() => notifBanner.classList.add("show"));
}
function hideNotificationBanner() {
  notifBanner.classList.remove("show");
  setTimeout(() => { notifBanner.hidden = true; }, 250);
}
notifDismiss.addEventListener("click", () => {
  bumpLastSeen();
  hideNotificationBanner();
});

// 8. auto-lowercase
function bindLowercaseInput(el) {
  if (el.dataset.lcBound) return;
  el.dataset.lcBound = "1";
  el.addEventListener("input", () => {
    if (el.value !== el.value.toLowerCase()) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = el.value.toLowerCase();
      try { el.setSelectionRange(start, end); } catch {}
    }
  });
}
function bindLowercaseContentEditable(el) {
  if (el.dataset.lcBound) return;
  el.dataset.lcBound = "1";
  el.addEventListener("input", () => {
    const text = el.textContent;
    if (text !== text.toLowerCase()) {
      const sel = window.getSelection();
      const offset = sel.focusOffset;
      el.textContent = text.toLowerCase();
      const range = document.createRange();
      if (el.firstChild) {
        range.setStart(el.firstChild, Math.min(offset, el.textContent.length));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  });
}
bindLowercaseInput(quickInput);
document.querySelectorAll(".manual-input").forEach(bindLowercaseInput);

// 9. hero date
function renderDate() {
  const d = new Date();
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  heroDate.textContent = `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`;
}
renderDate();

// 10. date helpers
const MS_DAY = 86400000;
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function nextWeekday(from, target) {
  const x = new Date(from);
  const diff = (target - x.getDay() + 7) % 7;
  x.setDate(x.getDate() + diff);
  return x;
}
function toDateInputValue(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDateInputValue(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}
function formatDueLabel(ts) {
  if (!ts) return null;
  const due = startOfDay(new Date(ts)).getTime();
  const today = startOfDay(new Date()).getTime();
  const diffDays = Math.round((due - today) / MS_DAY);
  if (diffDays < 0) {
    if (diffDays === -1) return { label: "yesterday", cls: "overdue" };
    if (diffDays >= -6) return { label: `${-diffDays}d ago`, cls: "overdue" };
    return { label: shortDate(new Date(ts)), cls: "overdue" };
  }
  if (diffDays === 0) return { label: "today", cls: "today" };
  if (diffDays === 1) return { label: "tomorrow", cls: "soon" };
  if (diffDays <= 6) {
    const days = ["sun","mon","tue","wed","thu","fri","sat"];
    return { label: days[new Date(ts).getDay()], cls: "soon" };
  }
  return { label: shortDate(new Date(ts)), cls: "later" };
}
function shortDate(d) {
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// 11. parser
// negative lookahead `(?!['’])` skips possessive forms like "josh's"
// or "oliver’s" so the name stays in the task text instead of being stripped
const NAME_PATTERNS = {
  oliver: /\b(oliver|ollie)\b(?!['’])/i,
  josh: /\b(josh|joshua)\b(?!['’])/i,
  dev: /\b(dev|devin)\b(?!['’])/i,
};
// global versions used for stripping ALL occurrences of the name from the
// task text (dictation sometimes repeats the name).
const NAME_PATTERNS_G = {
  oliver: /\b(oliver|ollie)\b(?!['’])/gi,
  josh: /\b(josh|joshua)\b(?!['’])/gi,
  dev: /\b(dev|devin)\b(?!['’])/gi,
};
const DAY_MAP = {
  sun:0, sunday:0, mon:1, monday:1, tue:2, tues:2, tuesday:2,
  wed:3, weds:3, wednesday:3, thu:4, thur:4, thurs:4, thursday:4,
  fri:5, friday:5, sat:6, saturday:6,
};
const DAY_KEYS = Object.keys(DAY_MAP).join("|");
const MONTH_MAP = {
  jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,
  jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,
  oct:9,october:9,nov:10,november:10,dec:11,december:11,
};
const MONTH_KEYS = Object.keys(MONTH_MAP).join("|");
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function extractTags(text) {
  const tags = [];
  const cleaned = text.replace(/#([a-zA-Z0-9_-]+)/g, (match, p1) => {
    const id = TAG_LOOKUP[normalizeTagKey(p1)];
    if (id && !tags.includes(id)) { tags.push(id); return " "; }
    return match;
  });
  return { tags, cleaned };
}
function extractDate(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  let m;
  // "today", "today morning/afternoon/evening/night", "this morning/afternoon/evening", "tonight"
  if ((m = lower.match(/\b(?:today(?:\s+(?:morning|afternoon|evening|night))?|this\s+(?:morning|afternoon|evening|night)|tonight)\b/))) {
    return { ts: startOfDay(now).getTime(), matched: m[0] };
  }
  // "tomorrow" optionally followed by "morning/afternoon/evening/night"
  if ((m = lower.match(/\b(?:tomorrow|tmrw|tmr)(?:\s+(?:morning|afternoon|evening|night))?\b/))) {
    return { ts: startOfDay(addDays(now, 1)).getTime(), matched: m[0] };
  }
  if ((m = lower.match(/\bthis\s+weekend\b/))) return { ts: startOfDay(nextWeekday(now, 6)).getTime(), matched: m[0] };
  if ((m = lower.match(/\bnext\s+week\b/))) return { ts: startOfDay(addDays(now, 7)).getTime(), matched: m[0] };
  if ((m = lower.match(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/))) {
    const n = parseInt(m[1], 10);
    const unit = m[2].startsWith("week") ? 7 : 1;
    return { ts: startOfDay(addDays(now, n * unit)).getTime(), matched: m[0] };
  }
  const dayRe = new RegExp(`\\b(?:next\\s+)?(${DAY_KEYS})(?:\\s+(?:morning|afternoon|evening|night))?\\b`);
  if ((m = lower.match(dayRe))) {
    const target = DAY_MAP[m[1]];
    let date = nextWeekday(now, target);
    if (/^next\s+/.test(m[0]) && target === now.getDay()) date = addDays(date, 7);
    return { ts: startOfDay(date).getTime(), matched: m[0] };
  }
  const monRe = new RegExp(`\\b(${MONTH_KEYS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`);
  if ((m = lower.match(monRe))) {
    const month = MONTH_MAP[m[1]];
    const day = parseInt(m[2], 10);
    let candidate = new Date(now.getFullYear(), month, day);
    if (candidate.getTime() < startOfDay(now).getTime() - MS_DAY) candidate.setFullYear(now.getFullYear() + 1);
    return { ts: startOfDay(candidate).getTime(), matched: m[0] };
  }
  if ((m = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/))) {
    const mo = parseInt(m[1], 10) - 1;
    const dy = parseInt(m[2], 10);
    let yr = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (yr < 100) yr += 2000;
    if (mo >= 0 && mo < 12 && dy >= 1 && dy <= 31) {
      let candidate = new Date(yr, mo, dy);
      if (!m[3] && candidate.getTime() < startOfDay(now).getTime() - MS_DAY) candidate.setFullYear(yr + 1);
      return { ts: startOfDay(candidate).getTime(), matched: m[0] };
    }
  }
  return { ts: null, matched: null };
}
function pad2(n) { return String(n).padStart(2, "0"); }

function extractTime(text) {
  let m;
  // 12-hour with am/pm — e.g., "3pm", "3:30pm", "at 3 pm"
  m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const period = m[3].toLowerCase().replace(/\./g, "");
    if (h >= 1 && h <= 12 && mm >= 0 && mm < 60) {
      if (period === "pm" && h !== 12) h += 12;
      if (period === "am" && h === 12) h = 0;
      return { time: `${pad2(h)}:${pad2(mm)}`, matched: m[0] };
    }
  }
  // 24-hour with colon — e.g., "15:30", "at 9:00"
  m = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) {
    return { time: `${pad2(parseInt(m[1], 10))}:${m[2]}`, matched: m[0] };
  }
  // "noon" / "midnight"
  m = text.match(/\b(?:at\s+)?(noon|midnight)\b/i);
  if (m) {
    return {
      time: m[1].toLowerCase() === "noon" ? "12:00" : "00:00",
      matched: m[0],
    };
  }
  return { time: null, matched: null };
}

function extractUrgency(text) {
  let level = 0;
  let cleaned = text;
  cleaned = cleaned.replace(/!{3,}/g, () => { level = Math.max(level, 3); return " "; });
  cleaned = cleaned.replace(/!{2}/g, () => { level = Math.max(level, 2); return " "; });
  cleaned = cleaned.replace(/\b(asap|critical)\b/gi, () => { level = Math.max(level, 3); return " "; });
  cleaned = cleaned.replace(/\burgent\b/gi, () => { level = Math.max(level, 2); return " "; });
  cleaned = cleaned.replace(/\b(important|priority)\b/gi, () => { level = Math.max(level, 1); return " "; });
  cleaned = cleaned.replace(/!\s*$/, () => { level = Math.max(level, 1); return ""; });
  return { urgency: level || null, cleaned };
}
function parseQuickInput(input) {
  const chunks = input
    .split(/\s*[\n,;]\s*|\s+and\s+(?=\b(?:oliver|ollie|josh|joshua|dev|devin)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return chunks.map(parseChunk).filter((t) => t.text);
}
function parseChunk(chunk) {
  // voice dictation sometimes drops the space after a name
  // (e.g. "oliverremind" instead of "oliver remind"). Insert a space so
  // the name detector matches it properly.
  let text = chunk.replace(/\b(oliver|ollie|josh|joshua|dev|devin)(?=[a-z])/gi, "$1 ");
  const tagResult = extractTags(text);
  text = tagResult.cleaned;
  const tags = tagResult.tags;

  let person = "unassigned";
  for (const p of PEOPLE) {
    if (NAME_PATTERNS[p] && NAME_PATTERNS[p].test(text)) {
      person = p;
      text = text.replace(NAME_PATTERNS_G[p], " "); // strip ALL occurrences
      break;
    }
  }

  const dateResult = extractDate(text);
  if (dateResult.matched) text = text.replace(new RegExp(escapeRegex(dateResult.matched), "i"), " ");
  let dueDate = dateResult.ts;

  const timeResult = extractTime(text);
  if (timeResult.matched) text = text.replace(new RegExp(escapeRegex(timeResult.matched), "i"), " ");
  const time = timeResult.time;

  // if a time was given without an explicit date, default the date to today
  if (time && !dueDate) {
    dueDate = startOfDay(new Date()).getTime();
  }

  const urgencyResult = extractUrgency(text);
  text = urgencyResult.cleaned;
  const urgency = urgencyResult.urgency;

  text = text
    .replace(/\s+/g, " ")
    .replace(/^[\s:\-–—]+/, "")
    .replace(/[\s:\-–—]+$/, "")
    // strip common voice-dictation intros only when the pattern is clearly
    // a dictation phrase (anchored to start). "remember" / "don't forget" /
    // "note to self" require an action word ("to") so we don't eat natural
    // uses like "remember the password" or "don't forget the keys".
    // `(?:remind\s+)+to` handles leftover "remind to" (or stuttered
    // "remind remind to") that's left over once a name like oliver is
    // extracted from "remind oliver to do X".
    // also tolerate a leftover time-of-day word between "remind" and "to"
    // (e.g. "remind remind morning to ..." after extractDate matched only "tomorrow")
    .replace(/^(remind me( to)?|(?:remind\s+)+(?:(?:in\s+the\s+)?(?:morning|afternoon|evening|night|early|late)\s+)?to|remember to|don'?t forget to|note to self( to)?|make sure (to|i)|i need to|i have to|i should|please)\s+/i, "")
    .replace(/^(to|for|should|needs? to|has to|gotta|must)\s+/i, "")
    .toLowerCase()
    .trim();

  return { person, text, dueDate, time, urgency, tags };
}

// 12. data normalization
function normalizeTask(t) {
  if (typeof t.urgent === "boolean") {
    if (t.urgent && !t.urgency) t.urgency = 2;
    delete t.urgent;
  } else if (typeof t.urgent === "number" && !t.urgency) {
    t.urgency = t.urgent;
    delete t.urgent;
  }
  return t;
}

// 13. sorting
function getSortFn(mode) {
  switch (mode) {
    case "due":
      return (a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const ad = a.dueDate || Number.POSITIVE_INFINITY;
        const bd = b.dueDate || Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd;
        return (a.createdAt || 0) - (b.createdAt || 0);
      };
    case "tag":
      return (a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const at = (a.tags && a.tags[0]) || "~~~"; // tagless to end
        const bt = (b.tags && b.tags[0]) || "~~~";
        const al = TAGS[at] ? TAGS[at].label : at;
        const bl = TAGS[bt] ? TAGS[bt].label : bt;
        if (al !== bl) return al.localeCompare(bl);
        // within same tag: most urgent first, then earliest due date
        const au = a.urgency || 0;
        const bu = b.urgency || 0;
        if (au !== bu) return bu - au;
        const ad = a.dueDate || Number.POSITIVE_INFINITY;
        const bd = b.dueDate || Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd;
        return (a.createdAt || 0) - (b.createdAt || 0);
      };
    case "newest":
      return (a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      };
    case "oldest":
      return (a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      };
    case "priority":
    default:
      return (a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (!a.done) {
          const au = a.urgency || 0;
          const bu = b.urgency || 0;
          if (au !== bu) return bu - au;
        }
        const ad = a.dueDate || Number.POSITIVE_INFINITY;
        const bd = b.dueDate || Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd;
        return (a.createdAt || 0) - (b.createdAt || 0);
      };
  }
}

// 14. render
function render() {
  const sortFn = getSortFn(sortMode);
  for (const person of PEOPLE) {
    const list = LIST_EL[person];
    const countEl = COUNT_EL[person];
    if (!list || !countEl) continue;
    let items = tasks.filter((t) => t.person === person && !t.parentId && t.kind !== "meeting" && t.kind !== "idea");
    if (filterTag) items = items.filter((t) => (t.tags || []).includes(filterTag));
    items.sort(sortFn);
    const open = items.filter((t) => !t.done).length;
    countEl.textContent = `${open} open · ${items.length} total`;
    list.innerHTML = "";
    items.forEach((t, idx) => {
      // group header when sorting by tag
      if (sortMode === "tag") {
        const curTagId = (t.tags && t.tags[0]) || "";
        const prevTagId = idx > 0 ? ((items[idx - 1].tags && items[idx - 1].tags[0]) || "") : "__init__";
        if (curTagId !== prevTagId) {
          const header = document.createElement("li");
          header.className = "task-group-header";
          const def = curTagId ? TAGS[curTagId] : null;
          header.textContent = def ? def.label : "no tag";
          if (def) header.classList.add(`tag-${def.color}`);
          list.appendChild(header);
        }
      }
      const el = buildTaskEl(t);
      const subs = tasks
        .filter((x) => x.parentId === t.id)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      if (subs.length) {
        const ul = document.createElement("ul");
        ul.className = "task-subtasks";
        subs.forEach((s) => ul.appendChild(buildSubtaskEl(s)));
        // append INSIDE the task-body so it stacks below, not beside it
        const body = el.querySelector(".task-body");
        if (body) body.appendChild(ul); else el.appendChild(ul);
      }
      list.appendChild(el);
    });
  }
  renderToday();
  applyMergeModeUI();
}

// build a small inline element for a sub-task inside a parent
function buildSubtaskEl(t) {
  const li = document.createElement("li");
  li.className = "task-subtask" + (t.done ? " done" : "");
  li.dataset.id = t.id;

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "subtask-checkbox";
  cb.checked = !!t.done;
  cb.addEventListener("change", () => toggleDone(t.id, cb.checked));
  li.appendChild(cb);

  const span = document.createElement("span");
  span.className = "subtask-text";
  span.textContent = (t.text || "").toLowerCase();
  span.title = "click to edit";
  span.setAttribute("autocapitalize", "none");
  span.setAttribute("spellcheck", "true");
  span.addEventListener("click", () => makeEditable(span, t.id));
  li.appendChild(span);

  const unmerge = document.createElement("button");
  unmerge.type = "button";
  unmerge.className = "subtask-unmerge";
  unmerge.title = "remove from group";
  unmerge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>`;
  unmerge.addEventListener("click", (e) => {
    e.stopPropagation();
    updateTask(t.id, { parentId: null });
  });
  li.appendChild(unmerge);

  return li;
}

function renderToday() {
  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = todayStart + MS_DAY;
  const items = tasks
    .filter((t) => t.kind !== "meeting" && t.kind !== "idea" && !t.parentId && !t.done && t.dueDate && t.dueDate < todayEnd)
    .sort((a, b) => {
      // overdue first, then by calendar day, then by time (earliest first; no-time goes last)
      const ad = a.dueDate ? startOfDay(new Date(a.dueDate)).getTime() : 0;
      const bd = b.dueDate ? startOfDay(new Date(b.dueDate)).getTime() : 0;
      if (ad !== bd) return ad - bd;
      const at = a.time || "99:99";
      const bt = b.time || "99:99";
      return at.localeCompare(bt);
    });
  if (!items.length) { todayPanel.hidden = true; return; }
  todayPanel.hidden = false;
  todayCount.textContent = items.length;
  todayList.innerHTML = "";
  // only reserve an "overdue" column if at least one item is actually overdue
  const anyOverdue = items.some((t) => t.dueDate < todayStart);
  for (const t of items) {
    const li = document.createElement("li");
    li.className = `today-item person-${t.person}`;
    li.dataset.id = t.id;
    const isOverdue = t.dueDate < todayStart;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "task-checkbox today-checkbox";
    cb.addEventListener("change", () => toggleDone(t.id, cb.checked));
    li.appendChild(cb);

    const personTag = document.createElement("span");
    personTag.className = "today-person";
    personTag.textContent = t.person;
    li.appendChild(personTag);

    // time cell (always present so alignment stays consistent)
    const timeCell = document.createElement("span");
    timeCell.className = "today-cell today-time-cell";
    if (t.time) {
      const timePill = document.createElement("span");
      timePill.className = "today-time";
      timePill.textContent = t.time;
      timeCell.appendChild(timePill);
    }
    li.appendChild(timeCell);

    const text = document.createElement("span");
    text.className = "today-text";
    text.textContent = (t.text || "").toLowerCase();
    li.appendChild(text);

    // tags cell (always present, may be empty)
    const tagsCell = document.createElement("span");
    tagsCell.className = "today-cell today-tags-cell";
    const tags = t.tags || [];
    for (const tagId of tags) {
      const def = TAGS[tagId];
      if (!def) continue;
      const pill = document.createElement("span");
      pill.className = `today-tag tag-${def.color}`;
      pill.textContent = def.label;
      tagsCell.appendChild(pill);
    }
    li.appendChild(tagsCell);

    // urgency cell (always present)
    const urgCell = document.createElement("span");
    urgCell.className = "today-cell today-urgency-cell";
    if (t.urgency) {
      const u = document.createElement("span");
      u.className = `today-urgency lvl-${t.urgency}`;
      u.textContent = "!".repeat(t.urgency);
      urgCell.appendChild(u);
    }
    li.appendChild(urgCell);

    // overdue cell — only reserved when at least one row has it, for alignment
    if (anyOverdue) {
      const overCell = document.createElement("span");
      overCell.className = "today-cell today-overdue-cell";
      if (isOverdue) {
        const badge = document.createElement("span");
        badge.className = "today-overdue";
        badge.textContent = "overdue";
        overCell.appendChild(badge);
      }
      li.appendChild(overCell);
    }

    todayList.appendChild(li);
  }
}

function buildTaskEl(t) {
  const li = document.createElement("li");
  const lvl = t.urgency || 0;
  li.className = "task-item" + (t.done ? " done" : "") + (lvl ? ` lvl-${lvl}` : "");
  li.dataset.id = t.id;

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "task-checkbox";
  cb.checked = !!t.done;
  cb.addEventListener("change", () => toggleDone(t.id, cb.checked));
  li.appendChild(cb);

  const body = document.createElement("div");
  body.className = "task-body";
  const main = document.createElement("div");
  main.className = "task-main";

  const span = document.createElement("span");
  span.className = "task-text";
  span.textContent = (t.text || "").toLowerCase();
  span.title = "click to edit";
  span.setAttribute("autocapitalize", "none");
  span.setAttribute("spellcheck", "true");
  span.addEventListener("click", () => makeEditable(span, t.id));
  main.appendChild(span);

  if (Array.isArray(t.sequence) && t.sequence.length) {
    const cur = t.sequence[t.sequenceStep || 0];
    if (cur && cur.text) {
      const stepCap = document.createElement("span");
      stepCap.className = "task-step-caption";
      stepCap.textContent = `now: ${cur.text}`;
      main.appendChild(stepCap);
    }
  }

  const meta = buildMetaEl(t);
  if (meta) main.appendChild(meta);
  body.appendChild(main);

  // notes — single inline-editable text, save on blur
  const notesPanel = document.createElement("div");
  notesPanel.className = "task-notes";
  if (!t.notes) notesPanel.hidden = true;

  const notesText = document.createElement("p");
  notesText.className = "task-notes-text";
  notesText.textContent = (t.notes || "").toLowerCase();
  notesText.setAttribute("autocapitalize", "none");
  notesText.setAttribute("autocorrect", "on");
  notesText.setAttribute("spellcheck", "true");
  notesText.title = "click to edit";
  notesPanel.appendChild(notesText);
  body.appendChild(notesPanel);

  function startEditingNotes() {
    notesPanel.hidden = false;
    if (notesText.getAttribute("contenteditable") === "true") {
      notesText.focus();
      return;
    }
    notesText.setAttribute("contenteditable", "true");
    bindLowercaseContentEditable(notesText);
    notesText.focus();
    const range = document.createRange();
    range.selectNodeContents(notesText);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  notesText.addEventListener("click", startEditingNotes);
  notesText.addEventListener("blur", async () => {
    notesText.removeAttribute("contenteditable");
    const v = notesText.textContent.trim().toLowerCase();
    if (v !== (t.notes || "")) {
      await updateTask(t.id, { notes: v || null });
    } else if (!t.notes && !v) {
      notesPanel.hidden = true;
    }
  });
  notesText.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      notesText.blur();
    } else if (e.key === "Escape") {
      notesText.textContent = (t.notes || "").toLowerCase();
      notesText.blur();
    }
  });

  const tagPicker = buildTagPickerEl(t);
  body.appendChild(tagPicker);
  li.appendChild(body);

  const actions = buildActionsEl(t, { startEditingNotes, tagPicker });
  li.appendChild(actions);
  return li;
}

function buildMetaEl(t) {
  const tags = t.tags || [];
  const hasSeq = Array.isArray(t.sequence) && t.sequence.length > 0;
  if (!tags.length && !t.dueDate && !t.urgency && !t.addedBy && !hasSeq) return null;
  const meta = document.createElement("div");
  meta.className = "task-meta";

  if (hasSeq) {
    const step = (t.sequenceStep || 0) + 1;
    const total = t.sequence.length;
    const cur = t.sequence[t.sequenceStep || 0];
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "task-seq-badge";
    badge.title = "click to edit handoff";
    badge.textContent = `handoff ${step}/${total} · ${cur ? cur.person : ""}`;
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      openSeqModal(t);
    });
    meta.appendChild(badge);
  }

  for (const tagId of tags) {
    const def = TAGS[tagId];
    if (!def) continue;
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `task-tag tag-${def.color}`;
    pill.title = "click to remove";
    pill.innerHTML = `<span>${def.label}</span><span class="tag-x" aria-hidden="true">×</span>`;
    pill.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newTags = (t.tags || []).filter((x) => x !== tagId);
      await updateTask(t.id, { tags: newTags });
    });
    meta.appendChild(pill);
  }

  if (t.dueDate) {
    const due = formatDueLabel(t.dueDate);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `task-due due-${due.cls}`;
    pill.title = "click to change date / time";
    const label = t.time ? `${due.label} · ${t.time}` : due.label;
    pill.innerHTML =
      `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>` +
      `<span>${label}</span>`;
    pill.addEventListener("click", (e) => { e.stopPropagation(); openDateModal(t); });
    meta.appendChild(pill);
  }

  if (t.urgency) {
    const lvl = t.urgency;
    const u = document.createElement("button");
    u.type = "button";
    u.className = `task-urgency lvl-${lvl}`;
    u.title = lvl === 3 ? "click to clear" : "click to escalate";
    u.innerHTML = `<span>${"!".repeat(lvl)}</span>`;
    u.addEventListener("click", async (e) => {
      e.stopPropagation();
      const next = lvl === 3 ? null : lvl + 1;
      await updateTask(t.id, { urgency: next });
    });
    meta.appendChild(u);
  }

  if (t.addedBy && PEOPLE.includes(t.addedBy)) {
    const by = document.createElement("span");
    by.className = `task-by by-${t.addedBy}`;
    by.textContent = `by ${t.addedBy}`;
    meta.appendChild(by);
  }

  return meta;
}

function buildTagPickerEl(t) {
  const wrap = document.createElement("div");
  wrap.className = "tag-picker";
  wrap.hidden = true;
  const inner = document.createElement("div");
  inner.className = "tag-picker-inner";
  for (const id of Object.keys(TAGS)) {
    const def = TAGS[id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tag-option tag-${def.color}`;
    btn.dataset.tagId = id;
    const isOn = (t.tags || []).includes(id);
    if (isOn) btn.classList.add("on");
    btn.innerHTML = `<span>${def.label}</span>`;
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const cur = t.tags || [];
      const newTags = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      await updateTask(t.id, { tags: newTags });
    });
    inner.appendChild(btn);
  }
  wrap.appendChild(inner);
  return wrap;
}

function buildActionsEl(t, { startEditingNotes, tagPicker }) {
  const actions = document.createElement("div");
  actions.className = "task-actions";

  // trigger button — collapses all action icons behind a "..." menu
  const trigger = document.createElement("button");
  trigger.className = "task-actions-trigger";
  trigger.title = "more actions";
  trigger.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>`;
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    // close any other open menus first
    document.querySelectorAll(".task-actions.open").forEach((el) => {
      if (el !== actions) el.classList.remove("open");
    });
    actions.classList.toggle("open");
  });
  actions.appendChild(trigger);

  // menu containing all the action buttons
  const menu = document.createElement("div");
  menu.className = "task-actions-menu";
  actions.appendChild(menu);
  // close menu when an inner action runs
  menu.addEventListener("click", () => {
    setTimeout(() => actions.classList.remove("open"), 0);
  });

  // helper that appends to the menu instead of actions root
  const _appendChild = actions.appendChild.bind(actions);
  actions.appendChild = (node) => menu.appendChild(node);

  if (!t.dueDate) {
    const b = document.createElement("button");
    b.className = "task-action-btn";
    b.title = "set date";
    b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`;
    b.addEventListener("click", () => openDateModal(t));
    actions.appendChild(b);
  }
  if (!t.urgency) {
    const b = document.createElement("button");
    b.className = "task-action-btn";
    b.title = "mark urgent";
    b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><circle cx="12" cy="19" r="1"/></svg>`;
    b.addEventListener("click", () => updateTask(t.id, { urgency: 1 }));
    actions.appendChild(b);
  }
  const tagBtn = document.createElement("button");
  tagBtn.className = "task-action-btn";
  tagBtn.title = "tags";
  tagBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/></svg>`;
  if ((t.tags || []).length) tagBtn.classList.add("has-data");
  tagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tagPicker.hidden = !tagPicker.hidden;
    if (!tagPicker.hidden) tagBtn.classList.add("active"); else tagBtn.classList.remove("active");
  });
  actions.appendChild(tagBtn);

  const notesBtn = document.createElement("button");
  notesBtn.className = "task-action-btn";
  notesBtn.title = "notes";
  notesBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`;
  if (t.notes) notesBtn.classList.add("has-data");
  notesBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startEditingNotes();
  });
  actions.appendChild(notesBtn);

  const mergeBtn = document.createElement("button");
  mergeBtn.className = "task-action-btn";
  mergeBtn.title = "group with other tasks";
  mergeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M9 12h6"/></svg>`;
  mergeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    enterMergeMode(t);
  });
  actions.appendChild(mergeBtn);

  const seqBtn = document.createElement("button");
  seqBtn.className = "task-action-btn";
  seqBtn.title = (Array.isArray(t.sequence) && t.sequence.length) ? "edit handoff" : "set up handoff";
  if (Array.isArray(t.sequence) && t.sequence.length) seqBtn.classList.add("has-data");
  seqBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  seqBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openSeqModal(t);
  });
  actions.appendChild(seqBtn);

  // move to the NEXT person in the list (oliver → josh → dev → oliver)
  const curIdx = PEOPLE.indexOf(t.person);
  const otherPerson = PEOPLE[(curIdx + 1) % PEOPLE.length] || PEOPLE[0];
  const swapBtn = document.createElement("button");
  swapBtn.className = "task-action-btn";
  swapBtn.title = `move to ${otherPerson}`;
  swapBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/></svg>`;
  swapBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const updates = { person: otherPerson };
    await updateTask(t.id, updates);
    // also move any sub-tasks along with the parent
    const subs = tasks.filter((x) => x.parentId === t.id);
    for (const s of subs) await updateTask(s.id, { person: otherPerson });
  });
  actions.appendChild(swapBtn);

  const del = document.createElement("button");
  del.className = "task-action-btn task-delete";
  del.title = "delete";
  del.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
  del.addEventListener("click", () => removeTask(t.id));
  actions.appendChild(del);

  return actions;
}
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

// 15. inline edit
function makeEditable(span, id) {
  if (mergeMode) return; // don't open editor while picking tasks to group
  if (span.getAttribute("contenteditable") === "true") return;
  span.setAttribute("contenteditable", "true");
  span.focus();
  bindLowercaseContentEditable(span);
  const range = document.createRange();
  range.selectNodeContents(span);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = async () => {
    span.removeAttribute("contenteditable");
    const newText = span.textContent.trim().toLowerCase();
    const original = tasks.find((t) => t.id === id);
    if (!original) return;
    if (!newText) { span.textContent = (original.text || "").toLowerCase(); return; }
    const parsed = parseChunk(newText);
    const updates = {};
    if (parsed.text && parsed.text !== original.text) updates.text = parsed.text;
    if (parsed.dueDate && parsed.dueDate !== original.dueDate) updates.dueDate = parsed.dueDate;
    if (parsed.time && parsed.time !== original.time) updates.time = parsed.time;
    if (parsed.urgency && parsed.urgency > (original.urgency || 0)) updates.urgency = parsed.urgency;
    if (parsed.tags && parsed.tags.length) {
      const merged = Array.from(new Set([...(original.tags || []), ...parsed.tags]));
      if (merged.length !== (original.tags || []).length) updates.tags = merged;
    }
    if (Object.keys(updates).length) await updateTask(id, updates);
    span.removeEventListener("blur", finish);
    span.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); span.blur(); }
    else if (e.key === "Escape") {
      span.textContent = (tasks.find((t) => t.id === id)?.text || "").toLowerCase();
      span.blur();
    }
  };
  span.addEventListener("blur", finish);
  span.addEventListener("keydown", onKey);
}

// 16. date modal
let dateModalTaskId = null;
function openDateModal(task) {
  dateModalTaskId = task.id;
  dateModalInput.value = task.dueDate ? toDateInputValue(task.dueDate) : "";
  dateModalTimeInput.value = task.time || "";
  dateModal.hidden = false;
  dateModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => dateModal.classList.add("open"));
}
function closeDateModal() {
  dateModal.classList.remove("open");
  dateModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setTimeout(() => { dateModal.hidden = true; }, 220);
  dateModalTaskId = null;
}
async function commitModalDate(ts, opts = {}) {
  if (!dateModalTaskId) return;
  const patch = { dueDate: ts };
  if (ts === null) {
    patch.time = null;
  } else if (opts.useTimeInput) {
    patch.time = dateModalTimeInput.value || null;
  }
  await updateTask(dateModalTaskId, patch);
  closeDateModal();
}
dateModalClose.addEventListener("click", closeDateModal);
dateModalBackdrop.addEventListener("click", closeDateModal);
dateModalClear.addEventListener("click", () => commitModalDate(null));
dateModalDone.addEventListener("click", () => {
  const ts = parseDateInputValue(dateModalInput.value);
  commitModalDate(ts, { useTimeInput: true });
});
dateModalInput.addEventListener("change", () => {
  const ts = parseDateInputValue(dateModalInput.value);
  if (ts !== null) commitModalDate(ts, { useTimeInput: true });
});
dateQuickRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".date-quick");
  if (!btn) return;
  const offset = parseInt(btn.dataset.offset, 10);
  commitModalDate(startOfDay(addDays(new Date(), offset)).getTime(), { useTimeInput: true });
});
dateDayRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".date-day");
  if (!btn) return;
  const target = parseInt(btn.dataset.day, 10);
  const x = new Date();
  const diff = (target - x.getDay() + 7) % 7;
  x.setDate(x.getDate() + (diff === 0 ? 7 : diff));
  commitModalDate(startOfDay(x).getTime(), { useTimeInput: true });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !dateModal.hidden) closeDateModal();
});

// 16a. ideas view
let ideasFilterTag = "";

async function addIdea(rawText) {
  const text = (rawText || "").trim();
  if (!text || !firebaseReady) return;
  const parsed = parseChunk(text);
  await addDoc(tasksCol, {
    kind: "idea",
    person: me,
    text: parsed.text || text,
    tags: parsed.tags || [],
    comments: [],
    addedBy: me,
    createdAt: Date.now(),
    serverTime: serverTimestamp(),
  });
}

// append a comment to an idea. comments are stored as an array on the idea
// doc: [{ by, text, createdAt }]
async function addIdeaComment(ideaId, text) {
  if (!firebaseReady) return;
  const clean = (text || "").trim().toLowerCase();
  if (!clean) return;
  const idea = tasks.find((t) => t.id === ideaId);
  if (!idea) return;
  const comments = Array.isArray(idea.comments) ? [...idea.comments] : [];
  comments.push({ by: me, text: clean, createdAt: Date.now() });
  await updateTask(ideaId, { comments });
}

async function deleteIdeaComment(ideaId, index) {
  const idea = tasks.find((t) => t.id === ideaId);
  if (!idea || !Array.isArray(idea.comments)) return;
  const comments = idea.comments.filter((_, i) => i !== index);
  await updateTask(ideaId, { comments });
}

function renderIdeas() {
  let items = tasks.filter((t) => t.kind === "idea");
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // build filter pills from tags used by existing ideas
  const usedTags = new Set();
  items.forEach((it) => (it.tags || []).forEach((t) => usedTags.add(t)));
  ideasFilter.innerHTML = "";
  if (usedTags.size > 0) {
    const allPill = document.createElement("button");
    allPill.type = "button";
    allPill.className = "ideas-filter-pill" + (ideasFilterTag === "" ? " active" : "");
    allPill.textContent = "all";
    allPill.addEventListener("click", () => { ideasFilterTag = ""; renderIdeas(); });
    ideasFilter.appendChild(allPill);
    for (const tagId of usedTags) {
      const def = TAGS[tagId];
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "ideas-filter-pill" + (ideasFilterTag === tagId ? " active" : "");
      pill.textContent = def ? def.label : tagId;
      pill.addEventListener("click", () => { ideasFilterTag = tagId; renderIdeas(); });
      ideasFilter.appendChild(pill);
    }
  }

  if (ideasFilterTag) {
    items = items.filter((it) => (it.tags || []).includes(ideasFilterTag));
  }

  ideasGrid.innerHTML = "";
  ideasEmpty.hidden = items.length > 0;

  for (const idea of items) {
    const card = document.createElement("div");
    card.className = "idea-card";
    card.dataset.id = idea.id;

    const textEl = document.createElement("div");
    textEl.className = "idea-card-text";
    textEl.textContent = (idea.text || "").toLowerCase();
    textEl.title = "click to edit";
    textEl.setAttribute("autocapitalize", "none");
    textEl.setAttribute("spellcheck", "true");
    textEl.addEventListener("click", () => makeIdeaTextEditable(textEl, idea.id));
    card.appendChild(textEl);

    if (idea.tags && idea.tags.length) {
      const tagsRow = document.createElement("div");
      tagsRow.className = "idea-card-tags";
      for (const tagId of idea.tags) {
        const def = TAGS[tagId];
        if (!def) continue;
        const pill = document.createElement("span");
        pill.className = `idea-card-tag tag-${def.color}`;
        pill.textContent = def.label;
        tagsRow.appendChild(pill);
      }
      card.appendChild(tagsRow);
    }

    const bottom = document.createElement("div");
    bottom.className = "idea-card-bottom";
    const by = document.createElement("span");
    by.textContent = `by ${idea.addedBy || idea.person || "?"}`;
    bottom.appendChild(by);
    if (idea.createdAt) {
      const when = document.createElement("span");
      const d = new Date(idea.createdAt);
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      when.textContent = `${months[d.getMonth()]} ${d.getDate()}`;
      bottom.appendChild(when);
    }
    card.appendChild(bottom);

    // --- comments thread ---
    const comments = Array.isArray(idea.comments) ? idea.comments : [];
    const commentsWrap = document.createElement("div");
    commentsWrap.className = "idea-comments";

    if (comments.length) {
      const list = document.createElement("div");
      list.className = "idea-comment-list";
      comments.forEach((c, ci) => {
        const row = document.createElement("div");
        row.className = "idea-comment";

        const who = document.createElement("span");
        who.className = `idea-comment-by by-${c.by || "unassigned"}`;
        who.textContent = c.by || "?";
        row.appendChild(who);

        const txt = document.createElement("span");
        txt.className = "idea-comment-text";
        txt.textContent = (c.text || "").toLowerCase();
        row.appendChild(txt);

        const cdel = document.createElement("button");
        cdel.type = "button";
        cdel.className = "idea-comment-del";
        cdel.title = "delete comment";
        cdel.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>`;
        cdel.addEventListener("click", async (e) => {
          e.stopPropagation();
          await deleteIdeaComment(idea.id, ci);
        });
        row.appendChild(cdel);

        list.appendChild(row);
      });
      commentsWrap.appendChild(list);
    }

    const cForm = document.createElement("form");
    cForm.className = "idea-comment-add";
    const cInput = document.createElement("input");
    cInput.type = "text";
    cInput.className = "idea-comment-input";
    cInput.placeholder = "add a comment…";
    cInput.setAttribute("autocomplete", "off");
    cInput.setAttribute("autocorrect", "on");
    cInput.setAttribute("autocapitalize", "none");
    cInput.setAttribute("spellcheck", "true");
    const cBtn = document.createElement("button");
    cBtn.type = "submit";
    cBtn.className = "idea-comment-btn";
    cBtn.setAttribute("aria-label", "post comment");
    cBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
    cForm.appendChild(cInput);
    cForm.appendChild(cBtn);
    cForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = cInput.value;
      if (!val.trim()) return;
      cInput.value = "";
      await addIdeaComment(idea.id, val);
    });
    commentsWrap.appendChild(cForm);
    card.appendChild(commentsWrap);

    const del = document.createElement("button");
    del.className = "idea-card-delete";
    del.title = "delete";
    del.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("delete this idea?")) await removeTask(idea.id);
    });
    card.appendChild(del);

    ideasGrid.appendChild(card);
  }
}

function makeIdeaTextEditable(span, id) {
  if (span.getAttribute("contenteditable") === "true") return;
  span.setAttribute("contenteditable", "true");
  span.focus();
  bindLowercaseContentEditable(span);
  const range = document.createRange();
  range.selectNodeContents(span);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = async () => {
    span.removeAttribute("contenteditable");
    const newText = span.textContent.trim().toLowerCase();
    const original = tasks.find((t) => t.id === id);
    if (!original) return;
    if (!newText) { span.textContent = (original.text || "").toLowerCase(); return; }
    if (newText !== (original.text || "")) {
      await updateTask(id, { text: newText });
    }
    span.removeEventListener("blur", finish);
    span.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); span.blur(); }
    else if (e.key === "Escape") {
      span.textContent = (tasks.find((t) => t.id === id)?.text || "").toLowerCase();
      span.blur();
    }
  };
  span.addEventListener("blur", finish);
  span.addEventListener("keydown", onKey);
}

if (ideaForm) {
  ideaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = ideaInput.value;
    if (!raw.trim()) return;
    ideaInput.value = "";
    await addIdea(raw);
  });
}
if (ideaInput) bindLowercaseInput(ideaInput);

// 16b. merge / grouping
let mergeMode = null; // { parentId: string, selected: Set<string> } | null

function enterMergeMode(parentTask) {
  if (parentTask.parentId) {
    alert("this task is already inside a group — un-group it first.");
    return;
  }
  mergeMode = { parentId: parentTask.id, selected: new Set() };
  mergeBarTarget.textContent = (parentTask.text || "").toLowerCase();
  mergeBarCount.textContent = "0 picked";
  mergeBar.hidden = false;
  document.body.classList.add("merge-active");
  applyMergeModeUI();
}

function exitMergeMode() {
  mergeMode = null;
  mergeBar.hidden = true;
  document.body.classList.remove("merge-active");
  // remove temporary classes
  document.querySelectorAll(".merge-source, .merge-candidate, .merge-picked")
    .forEach((el) => el.classList.remove("merge-source", "merge-candidate", "merge-picked"));
  // remove temporary click handlers by re-rendering
  render();
}

async function commitMerge() {
  if (!mergeMode) return;
  const parentId = mergeMode.parentId;
  const ids = Array.from(mergeMode.selected);
  if (!ids.length) { exitMergeMode(); return; }
  const parent = tasks.find((t) => t.id === parentId);
  if (!parent || !firebaseReady) { exitMergeMode(); return; }
  const batch = writeBatch(db);
  for (const id of ids) {
    const sub = tasks.find((x) => x.id === id);
    if (!sub) continue;
    const patch = { parentId, person: parent.person };
    batch.update(doc(tasksCol, id), patch);
    // also re-parent any of THIS sub's existing children up to the new parent
    const grandkids = tasks.filter((x) => x.parentId === id);
    for (const gk of grandkids) {
      batch.update(doc(tasksCol, gk.id), { parentId, person: parent.person });
    }
  }
  await batch.commit();
  exitMergeMode();
}

function applyMergeModeUI() {
  if (!mergeMode) return;
  const parent = tasks.find((t) => t.id === mergeMode.parentId);
  if (!parent) { exitMergeMode(); return; }
  const parentEl = document.querySelector(`.task-item[data-id="${mergeMode.parentId}"]`);
  if (parentEl) parentEl.classList.add("merge-source");

  document.querySelectorAll(".task-item").forEach((el) => {
    const id = el.dataset.id;
    if (id === mergeMode.parentId) return;
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.kind === "meeting") return;
    el.classList.add("merge-candidate");
    if (mergeMode.selected.has(id)) el.classList.add("merge-picked");
  });
  mergeBarCount.textContent = `${mergeMode.selected.size} picked`;
}

// delegated click handler — runs in capture phase so it intercepts
// inner button/checkbox clicks while merge mode is active
function delegatedMergeClick(e) {
  if (!mergeMode) return;
  const li = e.target.closest(".task-item.merge-candidate");
  if (!li) return;
  e.preventDefault();
  e.stopPropagation();
  const id = li.dataset.id;
  if (!id || id === mergeMode.parentId) return;
  if (mergeMode.selected.has(id)) {
    mergeMode.selected.delete(id);
    li.classList.remove("merge-picked");
  } else {
    mergeMode.selected.add(id);
    li.classList.add("merge-picked");
  }
  mergeBarCount.textContent = `${mergeMode.selected.size} picked`;
}
oliverList.addEventListener("click", delegatedMergeClick, true);
joshList.addEventListener("click", delegatedMergeClick, true);
if (devList) devList.addEventListener("click", delegatedMergeClick, true);

mergeBarCancel.addEventListener("click", exitMergeMode);
mergeBarDone.addEventListener("click", commitMerge);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mergeMode) exitMergeMode();
});

// 16c. view switching (list / calendar)
let currentView = getPref("view", "list");
function setView(name) {
  if (!["list", "calendar", "ideas"].includes(name)) name = "list";
  currentView = name;
  setPref("view", name);
  viewTabs.forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  viewList.hidden = name !== "list";
  viewCalendar.hidden = name !== "calendar";
  if (viewIdeas) viewIdeas.hidden = name !== "ideas";
  if (name === "calendar") renderCalendar();
  if (name === "ideas") renderIdeas();
}
viewTabs.forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

// 16d. calendar
let calMonth = { y: new Date().getFullYear(), m: new Date().getMonth() };
let selectedDay = null; // ms timestamp of start-of-day, or null

function renderCalendar() {
  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  calMonthLabel.textContent = `${monthNames[calMonth.m]} ${calMonth.y}`;

  const first = new Date(calMonth.y, calMonth.m, 1);
  const firstDow = first.getDay(); // Sun=0 ... Sat=6
  const gridStart = new Date(first);
  gridStart.setDate(1 - firstDow);

  calGrid.innerHTML = "";
  const today = startOfDay(new Date()).getTime();

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const cellDay = startOfDay(d).getTime();
    const cell = document.createElement("div");
    cell.className = "cal-day";
    if (d.getMonth() !== calMonth.m) cell.classList.add("other-month");
    if (cellDay === today) cell.classList.add("today");
    if (selectedDay === cellDay) cell.classList.add("selected");
    cell.dataset.day = String(cellDay);

    const num = document.createElement("div");
    num.className = "cal-day-num";
    num.textContent = d.getDate();
    cell.appendChild(num);

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "cal-day-items";

    const dayItems = itemsForDay(cellDay);
    const visible = dayItems.slice(0, 3);
    for (const it of visible) {
      const ch = document.createElement("div");
      const tt = it.time ? `${it.time} ` : "";
      const txt = (it.text || "").toLowerCase();
      if (it.kind === "meeting") {
        ch.className = "cal-item cal-item-meeting";
        ch.textContent = `${tt}${txt}`;
      } else {
        ch.className = `cal-item cal-item-task person-${it.person}` + (it.done ? " done" : "");
        ch.textContent = `${tt}${txt}`;
      }
      itemsWrap.appendChild(ch);
    }
    if (dayItems.length > visible.length) {
      const more = document.createElement("div");
      more.className = "cal-item-overflow";
      more.textContent = `+ ${dayItems.length - visible.length} more`;
      itemsWrap.appendChild(more);
    }
    cell.appendChild(itemsWrap);
    cell.addEventListener("click", () => selectDay(cellDay));
    calGrid.appendChild(cell);
  }

  if (selectedDay !== null && !calDayDetail.hidden) renderDayDetail(selectedDay);
}

function itemsForDay(dayStart) {
  const dayEnd = dayStart + MS_DAY;
  const ts = tasks.filter((t) => {
    if (t.kind === "idea") return false; // ideas don't belong on the calendar
    if (t.parentId) return false; // hide sub-tasks — they're handled with their parent
    if (!t.dueDate) return false;
    const d = startOfDay(new Date(t.dueDate)).getTime();
    return d === dayStart;
  });
  // sort: meetings first by time, then tasks
  return ts.sort((a, b) => {
    const am = a.kind === "meeting" ? 0 : 1;
    const bm = b.kind === "meeting" ? 0 : 1;
    if (am !== bm) return am - bm;
    if (a.kind === "meeting" && b.kind === "meeting") {
      return (a.time || "").localeCompare(b.time || "");
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function selectDay(dayStart) {
  selectedDay = dayStart;
  document.querySelectorAll(".cal-day").forEach((el) => {
    el.classList.toggle("selected", parseInt(el.dataset.day, 10) === dayStart);
  });
  openDayModal(dayStart);
}

function openDayModal(dayStart) {
  renderDayDetail(dayStart);
  calDayDetail.hidden = false;
  calDayDetail.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => calDayDetail.classList.add("open"));
}

function closeDayModal() {
  calDayDetail.classList.remove("open");
  calDayDetail.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setTimeout(() => { calDayDetail.hidden = true; }, 220);
  selectedDay = null;
  document.querySelectorAll(".cal-day.selected").forEach((el) => el.classList.remove("selected"));
}

function renderDayDetail(dayStart) {
  const d = new Date(dayStart);
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  calDetailTitle.textContent = `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`;
  // remember scroll position so a re-render doesn't yank you back to 7am
  const existingTl = calDetailBody.querySelector(".day-tl-body");
  const savedScroll = existingTl ? existingTl.scrollTop : null;
  // belt-and-braces: clean any orphan drop indicators before wiping the body
  document.querySelectorAll(".day-tl-drop-indicator").forEach((el) => el.remove());
  calDetailBody.innerHTML = "";

  const items = itemsForDay(dayStart);
  const timed = items.filter((it) => it.time);
  const allDay = items.filter((it) => !it.time);

  // ----- all-day strip -----
  const adWrap = document.createElement("div");
  adWrap.className = "day-tl-allday";
  const adLabel = document.createElement("span");
  adLabel.className = "day-tl-allday-label";
  adLabel.textContent = "all day";
  adWrap.appendChild(adLabel);
  if (!allDay.length) {
    const empty = document.createElement("span");
    empty.className = "day-tl-allday-empty";
    empty.textContent = "nothing without a time";
    adWrap.appendChild(empty);
  } else {
    for (const it of allDay) {
      const chip = document.createElement("span");
      chip.className = "day-tl-allday-item " + (it.kind === "meeting" ? "kind-meeting" : `kind-task person-${it.person}`);
      chip.textContent = (it.text || "").toLowerCase();
      chip.style.cursor = "grab";
      chip.title = "drag onto the timeline to set a time";
      makeAllDayChipDraggable(chip, it);
      adWrap.appendChild(chip);
    }
  }
  calDetailBody.appendChild(adWrap);

  // ----- timeline (24h grid) -----
  const tl = document.createElement("div");
  tl.className = "day-tl-body";

  const hoursCol = document.createElement("div");
  hoursCol.className = "day-tl-hours";
  for (let h = 0; h < 24; h++) {
    const hl = document.createElement("div");
    hl.className = "day-tl-hour-label";
    hl.textContent = String(h).padStart(2, "0") + ":00";
    hoursCol.appendChild(hl);
  }
  tl.appendChild(hoursCol);

  const eventsCol = document.createElement("div");
  eventsCol.className = "day-tl-events";

  // active 7am – 3pm band
  const band = document.createElement("div");
  band.className = "day-tl-active-band";
  band.style.top = (7 * 60) + "px";
  band.style.height = ((15 - 7) * 60) + "px";
  eventsCol.appendChild(band);

  // hour gridlines
  for (let h = 1; h < 24; h++) {
    const line = document.createElement("div");
    line.className = "day-tl-hour-line";
    line.style.top = (h * 60) + "px";
    eventsCol.appendChild(line);
  }

  // "now" line if today
  const today = startOfDay(new Date()).getTime();
  if (dayStart === today) {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const nowLine = document.createElement("div");
    nowLine.className = "day-tl-now-line";
    nowLine.style.top = minutes + "px";
    eventsCol.appendChild(nowLine);
  }

  // group events by their time slot so we can lay overlapping ones side-by-side
  const timeGroups = {};
  for (const it of timed) {
    const key = it.time || "—";
    if (!timeGroups[key]) timeGroups[key] = [];
    timeGroups[key].push(it);
  }

  // events
  for (const it of timed) {
    const [hh, mm] = (it.time || "0:0").split(":").map((n) => parseInt(n, 10));
    const top = (isNaN(hh) ? 0 : hh) * 60 + (isNaN(mm) ? 0 : mm);
    const evt = document.createElement("div");
    evt.className = "day-tl-event " +
      (it.kind === "meeting" ? "kind-meeting" : `kind-task person-${it.person}`) +
      (it.done ? " done" : "");
    evt.style.top = top + "px";
    const dur = (it.kind === "meeting" && it.duration) ? it.duration : 30;
    evt.style.height = Math.max(20, dur - 2) + "px"; // duration-driven block height

    // side-by-side layout for events sharing a time slot
    const group = timeGroups[it.time || "—"];
    const colCount = group.length;
    if (colCount > 1) {
      const colIdx = group.indexOf(it);
      const colPct = 100 / colCount;
      evt.style.left = `calc(${colIdx * colPct}% + 4px)`;
      evt.style.right = "auto";
      evt.style.width = `calc(${colPct}% - 8px)`;
    }

    const tt = document.createElement("span");
    tt.className = "day-tl-event-time";
    tt.textContent = it.time + (it.kind === "meeting" ? " · meeting" : "");
    evt.appendChild(tt);

    const txt = document.createElement("span");
    txt.className = "day-tl-event-text";
    txt.textContent = (it.text || "").toLowerCase();
    evt.appendChild(txt);

    if (it.kind === "meeting" && it.location) {
      const loc = document.createElement("span");
      loc.className = "day-tl-event-loc";
      loc.textContent = `@ ${(it.location || "").toLowerCase()}`;
      evt.appendChild(loc);
    }

    makeTimelineEventInteractive(evt, it);
    eventsCol.appendChild(evt);
  }

  tl.appendChild(eventsCol);
  calDetailBody.appendChild(tl);

  // restore prior scroll position if re-rendering, otherwise default to 7am
  requestAnimationFrame(() => {
    tl.scrollTop = savedScroll !== null ? savedScroll : 7 * 60 - 6;
  });
}

// drag-to-reschedule on the day timeline
const SNAP_MIN = 30; // snap to 30-minute increments

function pixelsToTimeStr(px) {
  const total = Math.max(0, Math.min(24 * 60 - 1, Math.round(px / SNAP_MIN) * SNAP_MIN));
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeStrToMinutes(t) {
  const [hh, mm] = (t || "0:0").split(":").map((n) => parseInt(n, 10));
  return (isNaN(hh) ? 0 : hh) * 60 + (isNaN(mm) ? 0 : mm);
}

function makeTimelineEventInteractive(evt, item) {
  const eventHeight = parseFloat(evt.style.height) || 28;
  const timeEl = evt.querySelector(".day-tl-event-time");

  evt.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    const startTop = timeStrToMinutes(item.time);
    let dragMode = false;
    let lastTop = startTop;

    function onMove(ev) {
      const delta = ev.clientY - startY;
      if (!dragMode && Math.abs(delta) > 4) {
        dragMode = true;
        evt.classList.add("dragging");
      }
      if (dragMode) {
        let newTop = Math.max(0, Math.min(24 * 60 - eventHeight, startTop + delta));
        newTop = Math.round(newTop / SNAP_MIN) * SNAP_MIN;
        evt.style.top = newTop + "px";
        lastTop = newTop;
        const newTime = pixelsToTimeStr(newTop);
        if (timeEl) timeEl.textContent = newTime + (item.kind === "meeting" ? " · meeting" : "");
      }
    }

    async function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (dragMode) {
        evt.classList.remove("dragging");
        const newTime = pixelsToTimeStr(lastTop);
        if (newTime !== item.time) {
          item.time = newTime; // optimistic
          try {
            await updateTask(item.id, { time: newTime });
          } catch (err) {
            console.error("failed to save time:", err);
          }
        }
      } else {
        // not a drag — treat as click
        if (item.kind === "meeting") openMeetingModal(item);
      }
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}

function makeAllDayChipDraggable(chip, item) {
  chip.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    // sweep any leftover indicators
    document.querySelectorAll(".day-tl-drop-indicator").forEach((el) => el.remove());
    const startX = e.clientX;
    const startY = e.clientY;
    let dragMode = false;
    let ghost = null;

    function ensureGhost() {
      if (ghost) return;
      ghost = chip.cloneNode(true);
      ghost.style.position = "fixed";
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.9";
      ghost.style.zIndex = "200";
      ghost.style.boxShadow = "0 4px 12px rgba(0,0,0,.18)";
      const r = chip.getBoundingClientRect();
      ghost.style.width = r.width + "px";
      ghost.style.left = r.left + "px";
      ghost.style.top = r.top + "px";
      document.body.appendChild(ghost);
      chip.style.opacity = "0.4";
    }

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragMode && Math.hypot(dx, dy) > 5) {
        dragMode = true;
        ensureGhost();
      }
      if (dragMode && ghost) {
        ghost.style.left = (ev.clientX - 60) + "px";
        ghost.style.top = (ev.clientY - 14) + "px";
        const eventsCol = document.querySelector(".day-tl-events");
        if (eventsCol) {
          const rect = eventsCol.getBoundingClientRect();
          const yIn = ev.clientY - rect.top;
          let indicator = eventsCol.querySelector(".day-tl-drop-indicator");
          if (yIn >= 0 && yIn <= 24 * 60 && ev.clientX >= rect.left && ev.clientX <= rect.right) {
            if (!indicator) {
              indicator = document.createElement("div");
              indicator.className = "day-tl-drop-indicator";
              eventsCol.appendChild(indicator);
            }
            const snapped = Math.round(yIn / SNAP_MIN) * SNAP_MIN;
            indicator.style.top = snapped + "px";
            indicator.textContent = pixelsToTimeStr(snapped);
          } else if (indicator) {
            indicator.remove();
          }
        }
      }
    }

    async function onUp(ev) {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (ghost) { ghost.remove(); ghost = null; }
      chip.style.opacity = "";
      document.querySelectorAll(".day-tl-drop-indicator").forEach((el) => el.remove());
      if (!dragMode) return;
      const eventsCol = document.querySelector(".day-tl-events");
      if (!eventsCol) return;
      const rect = eventsCol.getBoundingClientRect();
      const yIn = ev.clientY - rect.top;
      if (yIn >= 0 && yIn <= 24 * 60 && ev.clientX >= rect.left && ev.clientX <= rect.right) {
        const newTime = pixelsToTimeStr(yIn);
        item.time = newTime; // optimistic
        try {
          await updateTask(item.id, { time: newTime });
        } catch (err) {
          console.error("failed to save time on drop:", err);
        }
      }
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}

calPrev.addEventListener("click", () => {
  calMonth.m--;
  if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; }
  renderCalendar();
});
calNext.addEventListener("click", () => {
  calMonth.m++;
  if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; }
  renderCalendar();
});
calToday.addEventListener("click", () => {
  const n = new Date();
  calMonth = { y: n.getFullYear(), m: n.getMonth() };
  selectDay(startOfDay(n).getTime());
  renderCalendar();
});
calDetailClose.addEventListener("click", closeDayModal);
calDetailBackdrop.addEventListener("click", closeDayModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !calDayDetail.hidden) closeDayModal();
});

// 16e. meeting modal + CRUD
let editingMeetingId = null;
let meetingWhoSelected = "oliver";

function setMeetingWho(who) {
  meetingWhoSelected = who;
  meetingWhoBtns.forEach((b) => b.classList.toggle("active", b.dataset.who === who));
}
meetingWhoBtns.forEach((b) => b.addEventListener("click", () => setMeetingWho(b.dataset.who)));

function openMeetingModal(meeting) {
  editingMeetingId = meeting ? meeting.id : null;
  meetingModalTitle.textContent = meeting ? "edit meeting" : "new meeting";
  meetingTitleInput.value = meeting ? (meeting.text || "") : "";
  meetingDateInput.value = meeting && meeting.dueDate
    ? toDateInputValue(meeting.dueDate)
    : (selectedDay ? toDateInputValue(selectedDay) : toDateInputValue(Date.now()));
  meetingTimeInput.value = meeting ? (meeting.time || "") : "";
  meetingLocationInput.value = meeting ? (meeting.location || "") : "";
  meetingDurationInput.value = meeting && meeting.duration ? String(meeting.duration) : "30";
  setMeetingWho(meeting ? (meeting.person || "oliver") : "oliver");
  meetingModalDelete.hidden = !meeting;
  meetingModal.hidden = false;
  meetingModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => meetingModal.classList.add("open"));
}
function closeMeetingModal() {
  meetingModal.classList.remove("open");
  meetingModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setTimeout(() => { meetingModal.hidden = true; }, 220);
  editingMeetingId = null;
}
async function saveMeeting() {
  const title = meetingTitleInput.value.trim().toLowerCase();
  if (!title) { alert("please enter a title"); return; }
  const ts = parseDateInputValue(meetingDateInput.value);
  if (!ts) { alert("please pick a date"); return; }
  const time = meetingTimeInput.value || null;
  const location = meetingLocationInput.value.trim().toLowerCase() || null;
  const duration = parseInt(meetingDurationInput.value, 10) || 30;
  const who = [...PEOPLE, "all"].includes(meetingWhoSelected) ? meetingWhoSelected : "oliver";

  if (editingMeetingId) {
    await updateTask(editingMeetingId, { text: title, dueDate: ts, time, location, duration, person: who });
  } else {
    if (!firebaseReady) return;
    await addDoc(tasksCol, {
      kind: "meeting",
      person: who,
      text: title,
      dueDate: ts,
      time, location, duration,
      done: false,
      addedBy: me,
      createdAt: Date.now(),
      serverTime: serverTimestamp(),
    });
  }
  closeMeetingModal();
}
addMeetingBtn.addEventListener("click", () => openMeetingModal(null));
meetingModalSave.addEventListener("click", saveMeeting);
meetingModalClose.addEventListener("click", closeMeetingModal);
meetingModalBackdrop.addEventListener("click", closeMeetingModal);
meetingModalDelete.addEventListener("click", async () => {
  if (!editingMeetingId) return;
  if (!confirm("delete this meeting?")) return;
  await removeTask(editingMeetingId);
  closeMeetingModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !meetingModal.hidden) closeMeetingModal();
});

// 16f. handoff sequence modal
let seqEditingTaskId = null;
let seqDraft = []; // [{person: "oliver"|"josh"}]

function openSeqModal(task) {
  seqEditingTaskId = task.id;
  seqModalTaskText.textContent = task.text || "";
  seqDraft = Array.isArray(task.sequence) && task.sequence.length
    ? task.sequence.map((s) => ({ person: s.person }))
    : [{ person: "oliver" }, { person: "josh" }];
  seqModalClear.hidden = !(Array.isArray(task.sequence) && task.sequence.length);
  renderSeqList();
  seqModal.hidden = false;
  seqModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => seqModal.classList.add("open"));
}
function closeSeqModal() {
  seqModal.classList.remove("open");
  seqModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setTimeout(() => { seqModal.hidden = true; }, 220);
  seqEditingTaskId = null;
  seqDraft = [];
}
function renderSeqList() {
  seqList.innerHTML = "";
  seqDraft.forEach((step, idx) => {
    const row = document.createElement("div");
    row.className = "seq-step";

    const num = document.createElement("span");
    num.className = "seq-step-num";
    num.textContent = `step ${idx + 1}`;
    row.appendChild(num);

    const sel = document.createElement("select");
    sel.className = "seq-step-select";
    for (const p of PEOPLE) {
      const opt = document.createElement("option");
      opt.value = p; opt.textContent = p;
      if (p === step.person) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => { seqDraft[idx].person = sel.value; });
    row.appendChild(sel);

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "seq-step-remove";
    rm.title = "remove step";
    rm.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>`;
    rm.addEventListener("click", () => {
      if (seqDraft.length <= 1) return;
      seqDraft.splice(idx, 1);
      renderSeqList();
    });
    row.appendChild(rm);

    const txt = document.createElement("input");
    txt.type = "text";
    txt.className = "seq-step-text";
    txt.placeholder = "what does this person need to do? (optional)";
    txt.value = step.text || "";
    txt.autocomplete = "off";
    txt.addEventListener("input", () => { seqDraft[idx].text = txt.value; });
    row.appendChild(txt);

    seqList.appendChild(row);
  });
}
seqAddStep.addEventListener("click", () => {
  const last = seqDraft[seqDraft.length - 1];
  const lastIdx = last ? PEOPLE.indexOf(last.person) : -1;
  const next = PEOPLE[(lastIdx + 1) % PEOPLE.length] || PEOPLE[0];
  seqDraft.push({ person: next });
  renderSeqList();
});
seqModalSave.addEventListener("click", async () => {
  if (!seqEditingTaskId) return;
  const seq = seqDraft
    .filter((s) => PEOPLE.includes(s.person))
    .map((s) => ({ person: s.person, text: (s.text || "").trim().toLowerCase() || null }));
  if (!seq.length) { alert("you need at least one step"); return; }
  const t = tasks.find((x) => x.id === seqEditingTaskId);
  if (!t) { closeSeqModal(); return; }
  const stepIdx = t.sequenceStep && t.sequenceStep < seq.length ? t.sequenceStep : 0;
  const patch = {
    sequence: seq,
    sequenceStep: stepIdx,
    person: seq[stepIdx].person,
  };
  await updateTask(seqEditingTaskId, patch);
  closeSeqModal();
});
seqModalClear.addEventListener("click", async () => {
  if (!seqEditingTaskId) return;
  await updateTask(seqEditingTaskId, { sequence: null, sequenceStep: null });
  closeSeqModal();
});
seqModalClose.addEventListener("click", closeSeqModal);
seqModalBackdrop.addEventListener("click", closeSeqModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !seqModal.hidden) closeSeqModal();
});

// 17. firestore crud
async function addTask(person, text, extras = {}) {
  if (!firebaseReady) return alert("firebase not configured.");
  if (!PEOPLE.includes(person) || !text.trim()) return;
  await addDoc(tasksCol, {
    person,
    text: text.trim().toLowerCase(),
    done: false,
    urgency: extras.urgency || null,
    dueDate: extras.dueDate || null,
    time: extras.time || null,
    tags: extras.tags || [],
    notes: (extras.notes || "").toLowerCase() || null,
    addedBy: me,
    createdAt: Date.now(),
    serverTime: serverTimestamp(),
  });
}
async function updateTask(id, patch) {
  if (!firebaseReady) return;
  if (patch.text !== undefined && typeof patch.text === "string") patch.text = patch.text.toLowerCase();
  if (patch.notes !== undefined && typeof patch.notes === "string") patch.notes = patch.notes.toLowerCase();
  await updateDoc(doc(tasksCol, id), patch);
}
async function toggleDone(id, done) {
  const t = tasks.find((x) => x.id === id);
  if (t && Array.isArray(t.sequence) && t.sequence.length && done) {
    const nextStep = (t.sequenceStep || 0) + 1;
    if (nextStep < t.sequence.length) {
      // hand off to next person — task stays open, person changes
      await updateTask(id, {
        sequenceStep: nextStep,
        person: t.sequence[nextStep].person,
        done: false,
      });
      return;
    }
    // last step: mark fully done
  }
  await updateTask(id, { done });
}
async function removeTask(id) { if (firebaseReady) await deleteDoc(doc(tasksCol, id)); }
async function clearCompleted() {
  if (!firebaseReady) return;
  const snap = await getDocs(query(tasksCol, where("done", "==", true)));
  if (snap.empty) {
    setQuickStatus("nothing to clear", "");
    setTimeout(() => setQuickStatus("", ""), 1600);
    return;
  }
  if (!confirm(`delete ${snap.size} completed task${snap.size === 1 ? "" : "s"}?`)) return;
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// 18. realtime sync
function subscribe() {
  if (!firebaseReady) { setSync("offline · firebase not configured", "error"); return; }
  setSync("connecting", "");
  const q = query(tasksCol, orderBy("createdAt", "asc"));
  onSnapshot(q,
    (snap) => {
      tasks = snap.docs.map((d) => normalizeTask({ id: d.id, ...d.data() }));
      render();
      if (currentView === "calendar") renderCalendar();
      if (currentView === "ideas") renderIdeas();
      checkForNewTasks();
      setSync("synced", "live");
    },
    (err) => { console.error("snapshot error:", err); setSync("sync error", "error"); }
  );
}
function setSync(text, kind) {
  syncStatus.textContent = text;
  syncPill.className = "sync-pill" + (kind ? " " + kind : "");
}

// 19. quick add
async function handleQuickAdd() {
  const note = quickInput.value.trim();
  if (!note) return;
  if (!firebaseReady) { setQuickStatus("firebase not configured", "error"); return; }
  addBtn.disabled = true;
  try {
    const parsed = parseQuickInput(note);
    if (!parsed.length) { setQuickStatus("no tasks found", "error"); return; }
    let added = 0;
    for (const t of parsed) {
      let person = t.person;
      const text = t.text;
      if (!text) continue;
      if (!PEOPLE.includes(person)) {
        const choice = prompt(`who is this for?\n\n"${text}"\n\ntype: oliver, josh, dev, or skip`, "oliver");
        if (!choice) continue;
        const lower = choice.toLowerCase().trim();
        if (lower === "skip") continue;
        if (!PEOPLE.includes(lower)) continue;
        person = lower;
      }
      await addTask(person, text, { dueDate: t.dueDate, time: t.time, urgency: t.urgency, tags: t.tags });
      added++;
    }
    if (added > 0) {
      quickInput.value = "";
      setQuickStatus(`added ${added} task${added === 1 ? "" : "s"}`, "success");
      setTimeout(() => setQuickStatus("", ""), 2200);
    } else {
      setQuickStatus("nothing added", "error");
    }
  } catch (err) {
    console.error(err);
    setQuickStatus("something went wrong", "error");
  } finally {
    addBtn.disabled = false;
  }
}
function setQuickStatus(text, cls) {
  quickStatus.textContent = text;
  quickStatus.className = "qa-status" + (cls ? " " + cls : "");
}

// 20. manual add — opens the detailed modal with prefilled values
document.querySelectorAll(".manual-add").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const person = form.dataset.person;
    const input = form.querySelector(".manual-input");
    const raw = input.value.trim();
    if (!raw) return;
    input.value = "";
    const parsed = parseChunk(raw);
    openNewTaskModal({
      person: PEOPLE.includes(parsed.person) ? parsed.person : person,
      text: parsed.text || raw,
      dueDate: parsed.dueDate,
      time: parsed.time || "",
      urgency: parsed.urgency || 0,
      tags: parsed.tags || [],
    });
  });
});

// 20b. detailed new-task modal
const newTaskModal = $("#newTaskModal");
const newTaskModalBackdrop = $("#newTaskModalBackdrop");
const newTaskModalClose = $("#newTaskModalClose");
const newTaskModalCancel = $("#newTaskModalCancel");
const newTaskModalSave = $("#newTaskModalSave");
const ntText = $("#ntText");
const ntDate = $("#ntDate");
const ntTime = $("#ntTime");
const ntPersonRow = $("#ntPersonRow");
const ntUrgencyRow = $("#ntUrgencyRow");
const ntTagRow = $("#ntTagRow");

let ntDraft = { person: "oliver", urgency: 0, tags: [] };

function buildNtTagOptions() {
  ntTagRow.innerHTML = "";
  for (const id of Object.keys(TAGS)) {
    const def = TAGS[id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `nt-tag-pick tag-${def.color}`;
    btn.dataset.tagId = id;
    btn.textContent = def.label;
    btn.addEventListener("click", () => {
      const i = ntDraft.tags.indexOf(id);
      if (i >= 0) { ntDraft.tags.splice(i, 1); btn.classList.remove("active"); }
      else { ntDraft.tags.push(id); btn.classList.add("active"); }
    });
    ntTagRow.appendChild(btn);
  }
}
buildNtTagOptions();

function paintNtPicks() {
  ntPersonRow.querySelectorAll(".nt-pick").forEach((b) => {
    b.classList.toggle("active", b.dataset.person === ntDraft.person);
  });
  ntUrgencyRow.querySelectorAll(".nt-pick").forEach((b) => {
    b.classList.toggle("active", parseInt(b.dataset.urgency, 10) === ntDraft.urgency);
  });
  ntTagRow.querySelectorAll(".nt-tag-pick").forEach((b) => {
    b.classList.toggle("active", ntDraft.tags.includes(b.dataset.tagId));
  });
}

ntPersonRow.querySelectorAll(".nt-pick").forEach((b) => {
  b.addEventListener("click", () => { ntDraft.person = b.dataset.person; paintNtPicks(); });
});
ntUrgencyRow.querySelectorAll(".nt-pick").forEach((b) => {
  b.addEventListener("click", () => { ntDraft.urgency = parseInt(b.dataset.urgency, 10); paintNtPicks(); });
});

function openNewTaskModal(opts) {
  const o = (typeof opts === "string") ? { person: opts } : (opts || {});
  ntDraft = {
    person: PEOPLE.includes(o.person) ? o.person : "oliver",
    urgency: typeof o.urgency === "number" ? o.urgency : 0,
    tags: Array.isArray(o.tags) ? [...o.tags] : [],
  };
  ntText.value = o.text || "";
  ntDate.value = o.dueDate ? toDateInputValue(o.dueDate) : "";
  ntTime.value = o.time || "";
  paintNtPicks();
  newTaskModal.hidden = false;
  newTaskModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => newTaskModal.classList.add("open"));
  setTimeout(() => ntText.focus(), 50);
}
function closeNewTaskModal() {
  newTaskModal.classList.remove("open");
  newTaskModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setTimeout(() => { newTaskModal.hidden = true; }, 220);
}
async function saveNewTask() {
  const text = ntText.value.trim().toLowerCase();
  if (!text) { ntText.focus(); return; }
  const dueDate = parseDateInputValue(ntDate.value);
  const time = ntTime.value || null;
  await addTask(ntDraft.person, text, {
    dueDate,
    time: dueDate ? time : null,
    urgency: ntDraft.urgency || null,
    tags: [...ntDraft.tags],
  });
  closeNewTaskModal();
}
newTaskModalClose.addEventListener("click", closeNewTaskModal);
newTaskModalCancel.addEventListener("click", closeNewTaskModal);
newTaskModalBackdrop.addEventListener("click", closeNewTaskModal);
newTaskModalSave.addEventListener("click", saveNewTask);
ntText.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); saveNewTask(); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !newTaskModal.hidden) closeNewTaskModal();
});

// 21. wiring
addBtn.addEventListener("click", handleQuickAdd);
quickInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleQuickAdd(); }
});
clearDoneBtn.addEventListener("click", clearCompleted);
sortModeSel.addEventListener("change", () => {
  sortMode = sortModeSel.value;
  setPref("sortMode", sortMode);
  render();
});
filterTagSel.addEventListener("change", () => {
  filterTag = filterTagSel.value;
  setPref("filterTag", filterTag);
  render();
});

// close any open task-action menu when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".task-actions")) {
    document.querySelectorAll(".task-actions.open").forEach((el) => el.classList.remove("open"));
  }
});

// 21b. push notifications
let messagingInstance = null;

async function initMessaging() {
  if (!firebaseReady) return;
  try {
    if (!(await messagingIsSupported())) return;
    messagingInstance = getMessaging(firebaseApp);
    // foreground messages — when the app is open, show a small browser notification
    onMessage(messagingInstance, (payload) => {
      // foreground only — the SDK does NOT auto-display here, so we show manually.
      // Background is handled by the SDK auto-display from the `notification` payload.
      const n = payload.notification || {};
      if (!n.title) return;
      if (Notification.permission === "granted") {
        new Notification(n.title, {
          body: n.body || "",
          icon: "/apple-touch-icon1.png",
          tag: (payload.data && payload.data.tag) || "tasks-notif",
        });
      }
    });
  } catch (err) {
    console.warn("messaging init skipped:", err);
  }
}

async function subscribeToNotifications() {
  if (!firebaseReady) {
    alert("firebase isn't ready");
    return false;
  }
  if (!messagingInstance) {
    alert("notifications aren't supported on this browser/device");
    return false;
  }
  if (!("Notification" in window)) {
    alert("notifications aren't supported on this browser/device");
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("you'll need to allow notifications in your browser settings");
      return false;
    }
    // relative path so it works whether hosted at a domain root or a
    // github-pages subpath (e.g. /atlas-ceu-tasks/)
    const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) {
      alert("couldn't get a notification token — try again");
      return false;
    }
    // each device gets a stable id so we can identify "this physical device"
    // across different persons / browser sessions
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = (crypto.randomUUID && crypto.randomUUID()) ||
        (Date.now() + "-" + Math.random().toString(36).slice(2));
      localStorage.setItem("deviceId", deviceId);
    }

    // store the new token, tagged with this device's id and current person
    await setDoc(doc(fcmTokensCol, token), {
      token,
      person: me,
      deviceId,
      createdAt: Date.now(),
      userAgent: navigator.userAgent,
    });
    // wipe any other tokens for the SAME physical device only (matched by
    // deviceId — NOT userAgent, since two different iPhones share a userAgent).
    // This keeps one subscription per device while protecting other devices'
    // legacy tokens (which may not have a deviceId yet).
    try {
      const allSnap = await getDocs(query(fcmTokensCol));
      for (const d of allSnap.docs) {
        if (d.id === token) continue;
        const data = d.data();
        if (data.deviceId && data.deviceId === deviceId) {
          await deleteDoc(d.ref);
        }
      }
    } catch (err) {
      console.warn("token cleanup skipped:", err);
    }
    setPref("notifEnabled", "1");
    setPref("notifPerson", me);
    updateNotifBtn();
    return true;
  } catch (err) {
    console.error("notification setup failed:", err);
    alert("setup failed: " + (err.message || err));
    return false;
  }
}

function updateNotifBtn() {
  const btn = document.getElementById("notifBtn");
  if (!btn) return;
  const enabled = getPref("notifEnabled", "") === "1" && Notification.permission === "granted";
  btn.classList.toggle("on", enabled);
  btn.title = enabled ? "notifications on" : "turn on notifications";
}

// 22. boot
function tryLoadAvatarImages() {
  const exts = ["jpg", "jpeg", "png", "webp"];
  document.querySelectorAll(".avatar-img[data-person]").forEach((img) => {
    const person = img.dataset.person;
    let i = 0;
    const tryNext = () => {
      if (i >= exts.length) return;
      const url = `${person}.${exts[i++]}`;
      const test = new Image();
      test.onload = () => {
        img.src = url;
        img.parentElement.classList.add("has-image");
      };
      test.onerror = tryNext;
      test.src = url;
    };
    tryNext();
  });
}
tryLoadAvatarImages();
maybeShowIdentityModal();
subscribe();
render();
setView(currentView);
initMessaging().then(updateNotifBtn);

// version-check — show a red dot on the refresh button when a new version
// of the app has been deployed. Polls every 2 minutes + on tab focus.
let loadedAppVersion = null;
async function fetchAppVersion() {
  try {
    const res = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.deployedAt || null;
  } catch { return null; }
}
async function checkForUpdate() {
  const remote = await fetchAppVersion();
  if (!remote) return;
  if (loadedAppVersion === null) {
    loadedAppVersion = remote;
    return;
  }
  if (remote !== loadedAppVersion) {
    document.getElementById("refreshBtn")?.classList.add("update-available");
  }
}
checkForUpdate();
setInterval(checkForUpdate, 2 * 60 * 1000);
window.addEventListener("focus", checkForUpdate);

// hard-refresh button — clears caches AND unregisters the service worker, then reloads
const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.classList.add("spinning");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (err) {
      console.warn("cache clear failed:", err);
    }
    // also unregister all service workers so the next page load grabs a fresh one
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (err) {
      console.warn("sw unregister failed:", err);
    }
    window.location.href = window.location.pathname + "?_=" + Date.now();
  });
}

// notifications bell button in masthead
async function sendTestPing() {
  if (!firebaseReady) return;
  try {
    await addDoc(collection(db, "test_pings"), {
      person: me,
      sentAt: Date.now(),
    });
  } catch (err) {
    console.warn("test ping send failed:", err);
  }
}

const notifBtn = document.getElementById("notifBtn");
if (notifBtn) {
  notifBtn.addEventListener("click", async () => {
    const enabled = getPref("notifEnabled", "") === "1" && Notification.permission === "granted";
    if (enabled) {
      await sendTestPing();
      alert(
        `notifications are on. this device will ping when someone adds a task for ${me}, ` +
        `or when one of ${me}'s tasks is due.\n\n` +
        `a test ping was just sent — you should see a "test ping" notification within a few seconds. ` +
        `if you don't, check iOS Settings → Notifications → tasks and make sure they're allowed.`
      );
    } else {
      const ok = await subscribeToNotifications();
      if (ok) {
        await sendTestPing();
        alert(
          `notifications enabled! this device will ping when ${other} adds a task for ${me}, ` +
          `or when one of ${me}'s tasks is due. (works even when the app is closed.)\n\n` +
          `a test ping was just sent — watch for a "test ping" notification within a few seconds.`
        );
      }
    }
  });
}
