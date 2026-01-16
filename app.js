// app.js — manuale by Landek (animacje widoków + wbudowany tester)

const TESTER_URL = "https://landekkk.github.io/tester-dymkow-pwa/";

const listEl = document.getElementById("list");
const qEl = document.getElementById("q");
const metaEl = document.getElementById("meta");
const statusEl = document.getElementById("status");
const reloadBtn = document.getElementById("reload");

const viewList = document.getElementById("view-list");
const viewPdf = document.getElementById("view-pdf");
const viewTester = document.getElementById("view-tester");

const backPdfBtn = document.getElementById("backPdf");
const backTesterBtn = document.getElementById("backTester");

const pdfTitleEl = document.getElementById("pdfTitle");
const openHereBtn = document.getElementById("openHere");

const openTesterCard = document.getElementById("openTester");
const testerFrame = document.getElementById("testerFrame");

let all = [];
let currentPdf = null;
let activeView = viewList;

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function setAriaHidden(el, hidden) {
  el.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function switchView(next) {
  if (next === activeView) return;

  const prev = activeView;

  // przygotuj next
  next.classList.add("is-active");
  setAriaHidden(next, false);

  // start animacji next (kolejna klatka)
  requestAnimationFrame(() => {
    next.classList.add("is-visible");
    prev.classList.remove("is-visible");
  });

  // po animacji chowamy poprzedni
  const onDone = () => {
    prev.classList.remove("is-active");
    setAriaHidden(prev, true);
    prev.removeEventListener("transitionend", onDone);
  };

  // jeśli iOS czasem nie odpala transitionend, to i tak „dobij” timeoutem
  prev.addEventListener("transitionend", onDone);
  setTimeout(onDone, 260);

  activeView = next;
}

function showList() {
  switchView(viewList);
  currentPdf = null;
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
}

function openPdfSameTab(file) {
  // iOS/PWA: przewidywalne + działa cofanie
  window.open(file, "_self");
}

function showPdfPanel(item) {
  currentPdf = item;
  pdfTitleEl.textContent = item.title;

  openHereBtn.onclick = (e) => {
    e.preventDefault();
    openPdfSameTab(item.file);
  };

  switchView(viewPdf);
  history.pushState({ page: "pdf", file: item.file }, "", `#pdf=${encodeURIComponent(item.file)}`);
}

function showTesterPanel() {
  if (!testerFrame.src) testerFrame.src = TESTER_URL;
  switchView(viewTester);
  history.pushState({ page: "tester" }, "", "#tester");
}

function render() {
  const q = normalize(qEl.value);
  const filtered = all.filter(x => normalize(x.title).includes(q));

  listEl.innerHTML = "";
  metaEl.textContent = `Pozycji: ${filtered.length}${q ? ` (filtr: „${qEl.value}”)` : ""}`;

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "Brak wyników.";
    listEl.appendChild(li);
    return;
  }

  for (const item of filtered) {
    const li = document.createElement("li");
    li.className = "item pressable";

    const a = document.createElement("a");
    a.href = "#";
    a.textContent = item.title;

    a.addEventListener("click", (e) => {
      e.preventDefault();
      showPdfPanel(item);
    });

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "PDF";

    li.appendChild(a);
    li.appendChild(badge);
    listEl.appendChild(li);
  }
}

async function loadList({ bypassCache = false } = {}) {
  setStatus("Ładowanie listy…");
  try {
    const url = "./pdfs.json" + (bypassCache ? `?t=${Date.now()}` : "");
    const res = await fetch(url, { cache: bypassCache ? "no-store" : "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    all = Array.isArray(data)
      ? data.filter(x => x && typeof x.title === "string" && typeof x.file === "string")
      : [];

    render();
    setStatus("");

    restoreFromHash();
  } catch (e) {
    setStatus("Nie udało się wczytać pdfs.json. Sprawdź czy plik istnieje i jest poprawnym JSON-em.");
    console.error(e);
  }
}

function restoreFromHash() {
  if (location.hash === "#tester") {
    showTesterPanel();
    return;
  }
  const m = location.hash.match(/^#pdf=(.+)$/);
  if (!m) return;
  const file = decodeURIComponent(m[1]);
  const found = all.find(x => x.file === file);
  if (found) showPdfPanel(found);
}

qEl.addEventListener("input", render);
reloadBtn.addEventListener("click", () => loadList({ bypassCache: true }));

backPdfBtn.addEventListener("click", () => history.back());
backTesterBtn.addEventListener("click", () => history.back());

openTesterCard.addEventListener("click", showTesterPanel);
openTesterCard.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") showTesterPanel();
});

window.addEventListener("popstate", (ev) => {
  const st = ev.state;
  if (!st || st.page === "list") showList();
  else if (st.page === "pdf") {
    const found = all.find(x => x.file === st.file);
    if (found) showPdfPanel(found);
    else showList();
  } else if (st.page === "tester") showTesterPanel();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

// start: ustaw widoczność pierwszego widoku (fade in)
viewList.classList.add("is-active");
requestAnimationFrame(() => viewList.classList.add("is-visible"));

history.replaceState({ page: "list" }, "", location.pathname + location.search);
loadList({ bypassCache: true });
