// app.js — manuale by Landek (iOS-friendly: panel PDF + wbudowany tester)

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

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function showOnly(section) {
  viewList.style.display = section === "list" ? "" : "none";
  viewPdf.style.display = section === "pdf" ? "" : "none";
  viewTester.style.display = section === "tester" ? "" : "none";
}

function showList() {
  showOnly("list");
  currentPdf = null;
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
}

function openPdfSameTab(file) {
  // iOS/PWA: najbardziej przewidywalne + działa cofanie
  window.open(file, "_self");
}

function showPdfPanel(item) {
  currentPdf = item;
  showOnly("pdf");

  pdfTitleEl.textContent = item.title;

  openHereBtn.onclick = (e) => {
    e.preventDefault();
    openPdfSameTab(item.file);
  };

  history.pushState({ page: "pdf", file: item.file }, "", `#pdf=${encodeURIComponent(item.file)}`);
}

function showTesterPanel() {
  showOnly("tester");

  // ustaw src tylko raz (żeby nie przeładowywać bez potrzeby)
  if (!testerFrame.src) testerFrame.src = TESTER_URL;

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
    li.className = "item";

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
    // jeśli ktoś wróci do pdf state po historii
    const found = all.find(x => x.file === st.file);
    if (found) showPdfPanel(found);
    else showList();
  } else if (st.page === "tester") showTesterPanel();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

// iOS: agresywny cache — bierz świeże pdfs.json na starcie
history.replaceState({ page: "list" }, "", location.pathname + location.search);
loadList({ bypassCache: true });
