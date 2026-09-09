
const FREQ = {
  weekly: { n: 52, label: "Weekly" },
  biweekly: { n: 26, label: "Every 2 weeks" },
  semimonthly: { n: 24, label: "Twice a month" },
  monthly: { n: 12, label: "Monthly" },
  quarterly: { n: 4, label: "Quarterly" },
  yearly: { n: 1, label: "Yearly" }
};
const PAY_FREQS = ["weekly","biweekly","semimonthly","monthly"];
const BILL_FREQS = ["weekly","biweekly","monthly","quarterly","yearly"];
const DB_NAME = "ledger-db";
const DB_STORE = "state";

let period = "week";
let who = "all";
const navStack = ["home"];
const PAGE_TITLES = { home: "", settings: "Settings", editor: "Edit" };
const store = {
  people: { p1: "You", p2: "Partner" },
  pays: [],
  bills: [],
  theme: "light"
};

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbRead() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const q = tx.objectStore(DB_STORE).get("app");
    q.onsuccess = () => resolve(q.result || null);
    q.onerror = () => reject(q.error);
  });
}
async function idbWrite(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(data, "app");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function lsFallbackWrite() {
  localStorage.setItem("ledger_state", JSON.stringify(store));
}
async function persist() {
  try { await idbWrite(store); }
  catch (e) { lsFallbackWrite(); }
  lsFallbackWrite();
}
async function load() {
  let data = null;
  try { data = await idbRead(); } catch (e) {}
  if (!data) {
    const raw = localStorage.getItem("ledger_state");
    if (raw) data = JSON.parse(raw);
  }
  if (!data) {
    const pays = JSON.parse(localStorage.getItem("ledger_pays") || "[]");
    const bills = JSON.parse(localStorage.getItem("ledger_bills") || "[]");
    data = {
      people: { p1: "You", p2: "Partner" },
      pays: pays.map(p => ({ ...p, owner: p.owner || "p1" })),
      bills: bills.map(b => ({ ...b, owner: b.owner || "shared" }))
    };
  }
  store.people = data.people || { p1: "You", p2: "Partner" };
  store.pays = data.pays || [];
  store.bills = data.bills || [];
  store.theme = data.theme === "dark" ? "dark" : "light";
  applyTheme();
  await persist();
}

function annual(item) { return Number(item.amount || 0) * (FREQ[item.freq]?.n || 12); }
function byPeriod(annualAmt) {
  if (period === "week") return annualAmt / 52;
  if (period === "month") return annualAmt / 12;
  return annualAmt;
}
function money(n, compact) {
  const abs = Math.abs(n);
  const opts = compact && abs >= 10000
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: abs % 1 ? 2 : 0, maximumFractionDigits: 2 };
  return (n < 0 ? "−" : "") + "$" + abs.toLocaleString(undefined, opts);
}
function iconFor(name, kind) {
  const s = (name || "").toLowerCase();
  const icons = {
    pay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 9h17"/><circle cx="12" cy="13.5" r="2.1"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3.8 10.7 8.2-6.9 8.2 6.9"/><path d="M5.8 9.8v9.2h12.4V9.8"/><path d="M9.5 19v-5h5v5"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5.2 10.2 1.5-4h10.6l1.5 4"/><path d="M4 10.2h16v7.2H4z"/><circle cx="7.5" cy="17.4" r="1.2"/><circle cx="16.5" cy="17.4" r="1.2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 19 6v5.2c0 4.3-2.8 7.8-7 9.3-4.2-1.5-7-5-7-9.3V6l7-2.5Z"/><path d="m9.2 12 1.8 1.8 3.9-4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3.5" width="10" height="17" rx="2.2"/><path d="M10 6h4M11 17.5h2"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 9.5a12 12 0 0 1 16 0"/><path d="M7 12.7a7.6 7.6 0 0 1 10 0"/><path d="M10 15.8a3.4 3.4 0 0 1 4 0"/><circle cx="12" cy="19" r=".8" fill="currentColor" stroke="none"/></svg>',
    electric: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m13.5 2.8-7 11h5.4l-1.2 7.4 7-11h-5.4l1.2-7.4Z"/></svg>',
    gas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 3.5c.4 3-2.4 4.2-2.7 6.6-.2 1.5.7 2.6 1.7 3.3.3-1.7 1.7-2.5 1.6-4.5 2.7 2.1 4.2 4.6 3.8 7.1-.5 3.1-3.2 4.9-5.8 4.9-3.7 0-6.4-2.8-6.4-6.2 0-4.2 3.7-6.6 7.8-11.2Z"/><path d="M10.7 16.2c0 1.1.6 1.8 1.6 2.2"/></svg>',
    water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5Z"/><path d="M9.5 15.5a2.8 2.8 0 0 0 2.5 1.6"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h2l1.5 10.5h9.8L19 8H7"/><circle cx="9.5" cy="19" r="1.1"/><circle cx="16.5" cy="19" r="1.1"/></svg>',
    health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.2S4.2 15.7 4.2 9.5A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.8 1.9c0 6.2-7.8 10.7-7.8 10.7Z"/><path d="M8.8 12h2l1-2.2 1.4 4.4 1-2.2h1.9"/></svg>',
    gym: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
    document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.8h8l4 4v12.4H6z"/><path d="M14 3.8v4h4M9 12h6M9 15.5h6"/></svg>'
  };
  if (kind === "pay") return icons.pay;
  if (/rent|mortgage|home|apt|apartment/.test(s)) return icons.home;
  if (/car|auto|truck|vehicle/.test(s)) return icons.car;
  if (/insur/.test(s)) return icons.shield;
  if (/phone|cell|mobile/.test(s)) return icons.phone;
  if (/internet|wifi/.test(s)) return icons.wifi;
  if (/electric|power|utility/.test(s)) return icons.electric;
  if (/gas/.test(s)) return icons.gas;
  if (/water/.test(s)) return icons.water;
  if (/food|groc/.test(s)) return icons.cart;
  if (/health|doctor|dental/.test(s)) return icons.health;
  if (/gym|fit/.test(s)) return icons.gym;
  if (/netflix|hulu|spotify|sub/.test(s)) return icons.media;
  return icons.document;
}
function ownerLabel(owner) {
  if (owner === "p1") return store.people.p1;
  if (owner === "p2") return store.people.p2;
  return "Shared";
}
function visible(item) {
  if (who === "all") return true;
  return item.owner === who;
}
function setPeriod(p, btn) {
  period = p;
  document.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b === btn));
  render();
}
function setWho(w, btn) {
  who = w;
  document.querySelectorAll(".who button").forEach(b => b.classList.toggle("on", b === btn));
  render();
}
function nextDue(dueDay) {
  if (!dueDay) return null;
  const now = new Date();
  const cap = (y,m) => new Date(y, m+1, 0).getDate();
  let d = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, cap(now.getFullYear(), now.getMonth())));
  d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  if (d < today) {
    const m = now.getMonth()+1;
    d = new Date(now.getFullYear(), m, Math.min(dueDay, cap(now.getFullYear(), m)));
  }
  return d;
}
function fillOwnerSelect(selected) {
  const sel = document.getElementById("fOwner");
  sel.innerHTML = `
    <option value="p1">${esc(store.people.p1)}</option>
    <option value="p2">${esc(store.people.p2)}</option>
    <option value="shared">Shared / household</option>
  `;
  sel.value = selected || (who === "p2" ? "p2" : who === "p1" ? "p1" : "shared");
}
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("on"));
  const el = document.getElementById(name + "Page");
  if (el) el.classList.add("on");
  document.body.classList.remove("subpage", "page-home", "page-settings", "page-editor");
  if (name !== "home") document.body.classList.add("subpage", "page-" + name);
  document.getElementById("pageTitle").textContent = PAGE_TITLES[name] || "";
}
function openPage(name) {
  if (navStack[navStack.length - 1] !== name) navStack.push(name);
  if (name === "settings") {
    document.getElementById("n1").value = store.people.p1;
    document.getElementById("n2").value = store.people.p2;
    applyTheme();
  }
  showPage(name);
}
function goBack() {
  if (navStack.length > 1) navStack.pop();
  const prev = navStack[navStack.length - 1] || "home";
  showPage(prev);
}
function goHome() {
  navStack.length = 0;
  navStack.push("home");
  showPage("home");
}
function openSheet(kind, item) {
  const isBill = kind === "bill";
  const title = item ? (isBill ? "Edit bill" : "Edit paycheck") : (isBill ? "Add bill" : "Add paycheck");
  document.getElementById("sheetTitle").textContent = title;
  PAGE_TITLES.editor = title;
  document.getElementById("editKind").value = kind;
  document.getElementById("editId").value = item?.id || "";
  document.getElementById("fName").value = item?.name || "";
  document.getElementById("fAmt").value = item?.amount || "";
  document.getElementById("fDue").value = item?.due || "";
  document.getElementById("fType").value = item?.type || "fixed";
  document.getElementById("billExtras").style.display = isBill ? "grid" : "none";
  document.getElementById("deleteBtn").style.display = item ? "block" : "none";
  const sel = document.getElementById("fFreq");
  const list = isBill ? BILL_FREQS : PAY_FREQS;
  sel.innerHTML = list.map(k => `<option value="${k}">${FREQ[k].label}</option>`).join("");
  sel.value = item?.freq || (isBill ? "monthly" : "biweekly");
  fillOwnerSelect(item?.owner);
  openPage("editor");
  setTimeout(() => document.getElementById("fName").focus(), 200);
}
function closeSheet() { goBack(); }
function saveItem(e) {
  e.preventDefault();
  const kind = document.getElementById("editKind").value;
  const id = document.getElementById("editId").value || crypto.randomUUID();
  const item = {
    id,
    name: document.getElementById("fName").value.trim(),
    amount: Number(document.getElementById("fAmt").value),
    freq: document.getElementById("fFreq").value,
    owner: document.getElementById("fOwner").value
  };
  if (!item.name || !item.amount) return;
  if (kind === "bill") {
    item.due = Number(document.getElementById("fDue").value) || null;
    item.type = document.getElementById("fType").value;
    const i = store.bills.findIndex(b => b.id === id);
    if (i >= 0) store.bills[i] = item; else store.bills.push(item);
  } else {
    const i = store.pays.findIndex(b => b.id === id);
    if (i >= 0) store.pays[i] = item; else store.pays.push(item);
  }
  persist(); goBack(); render();
}
function deleteItem() {
  const kind = document.getElementById("editKind").value;
  const id = document.getElementById("editId").value;
  if (!id) return;
  const collection = kind === "bill" ? store.bills : store.pays;
  const item = collection.find(x => x.id === id);
  document.getElementById("confirmText").textContent =
    item ? `Delete “${item.name}”? This action can’t be undone.` : "This action can’t be undone.";
  document.getElementById("confirmBg").classList.add("show");
}
function closeDeleteConfirm() {
  document.getElementById("confirmBg").classList.remove("show");
}
function confirmDelete() {
  const kind = document.getElementById("editKind").value;
  const id = document.getElementById("editId").value;
  if (kind === "bill") store.bills = store.bills.filter(b => b.id !== id);
  else store.pays = store.pays.filter(p => p.id !== id);
  closeDeleteConfirm();
  persist(); goHome(); render();
}
function applyTheme() {
  const dark = store.theme === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#0E1116" : "#F3F1EC");
  document.getElementById("themeLight").classList.toggle("on", !dark);
  document.getElementById("themeDark").classList.toggle("on", dark);
}
function setTheme(mode) {
  store.theme = mode;
  applyTheme();
  persist();
  toast(mode === "dark" ? "Dark mode" : "Light mode");
}
function saveNames() {
  store.people.p1 = document.getElementById("n1").value.trim() || "You";
  store.people.p2 = document.getElementById("n2").value.trim() || "Partner";
  persist(); render();
  toast("Names saved");
}
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1800);
}
function backup() {
  const payload = {
    app: "bills",
    version: 2,
    exportedAt: new Date().toISOString(),
    people: store.people,
    pays: store.pays,
    bills: store.bills,
    theme: store.theme
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bills-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup downloaded");
}
function restore(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.pays) || !Array.isArray(data.bills)) {
        throw new Error("bad file");
      }
      if (!confirm("Replace all paychecks and bills on this phone with the backup?")) return;
      store.people = data.people || store.people;
      store.pays = data.pays;
      store.bills = data.bills;
      store.theme = data.theme === "dark" ? "dark" : (data.theme === "light" ? "light" : store.theme);
      persist(); applyTheme(); render();
      document.getElementById("n1").value = store.people.p1;
      document.getElementById("n2").value = store.people.p2;
      toast("Backup restored");
    } catch (e) {
      toast("Could not read that file");
    }
  };
  reader.readAsText(file);
}
function periodWord() { return period === "week" ? "week" : period === "month" ? "month" : "year"; }
function whoTitle() {
  if (who === "p1") return store.people.p1;
  if (who === "p2") return store.people.p2;
  return "Combined";
}
function render() {
  document.getElementById("tabP1").textContent = store.people.p1;
  document.getElementById("tabP2").textContent = store.people.p2;

  const pays = store.pays.filter(visible);
  const bills = store.bills.filter(visible);
  const incomeY = pays.reduce((s,p) => s + annual(p), 0);
  const billsY = bills.reduce((s,b) => s + annual(b), 0);
  const left = byPeriod(incomeY - billsY);
  const hero = document.getElementById("heroAmt");
  hero.textContent = money(left, true);
  hero.classList.toggle("neg", left < 0);
  document.getElementById("heroKicker").textContent = whoTitle() + " · left after bills";
  document.getElementById("heroHint").textContent = pays.length
    ? "After committed bills · per " + periodWord()
    : "Add a paycheck to see what’s left";
  document.getElementById("incNum").textContent = money(byPeriod(incomeY), true);
  document.getElementById("billNum").textContent = money(byPeriod(billsY), true);

  document.getElementById("payList").innerHTML = pays.length ? pays.map(p => `
    <button class="row" onclick='openSheet("pay", ${JSON.stringify(p)})'>
      <div class="avatar">${iconFor(p.name,"pay")}</div>
      <div class="row-main">
        <div class="row-title">${esc(p.name)}</div>
        <div class="row-sub">${FREQ[p.freq].label} · ${esc(ownerLabel(p.owner))}</div>
      </div>
      <div class="row-amt">${money(p.amount)}<small>${money(byPeriod(annual(p)))} / ${periodWord()}</small></div>
    </button>
  `).join("") : `<div class="empty">No paychecks in this view</div>`;

  const sorted = [...bills].sort((a,b) => (a.due||99) - (b.due||99));
  document.getElementById("billList").innerHTML = sorted.length ? sorted.map(b => `
    <button class="row" onclick='openSheet("bill", ${JSON.stringify(b)})'>
      <div class="avatar">${iconFor(b.name,"bill")}</div>
      <div class="row-main">
        <div class="row-title">${esc(b.name)}${b.type==="sinking" ? '<span class="chip">sinking</span>' : ""}${b.owner==="shared" && who==="all" ? '<span class="chip">shared</span>' : ""}</div>
        <div class="row-sub">${FREQ[b.freq].label}${b.due ? " · due " + b.due : ""} · ${esc(ownerLabel(b.owner))}</div>
      </div>
      <div class="row-amt">${money(b.amount)}<small>${money(byPeriod(annual(b)))} / ${periodWord()}</small></div>
    </button>
  `).join("") : `<div class="empty">No bills in this view</div>`;

  const upcoming = bills
    .map(b => ({...b, when: nextDue(b.due)}))
    .filter(b => b.when && (b.when - Date.now())/86400000 <= 31)
    .sort((a,b) => a.when - b.when);

  document.getElementById("upcoming").innerHTML = upcoming.length ? upcoming.map(b => `
    <div class="row">
      <div class="avatar">${iconFor(b.name,"bill")}</div>
      <div class="row-main">
        <div class="row-title">${esc(b.name)}</div>
        <div class="row-sub"><span class="due-dot"></span>${b.when.toLocaleDateString(undefined,{weekday:"short", month:"short", day:"numeric"})} · ${esc(ownerLabel(b.owner))}</div>
      </div>
      <div class="row-amt">${money(b.amount)}</div>
    </div>
  `).join("") : `<div class="empty">Due dates will land here</div>`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

load().then(() => {
  render();
  if (location.hash === "#settings") openPage("settings");
  if (location.hash === "#editor") openSheet("bill");
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
