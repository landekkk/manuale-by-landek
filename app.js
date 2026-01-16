// app.js — manuale by Landek (iOS-friendly, panel + systemowy viewer PDF)

const listEl = document.getElementById("list");
const qEl = document.getElementById("q");
const metaEl = document.getElementById("meta");
const statusEl = document.getElementById("status");
const reloadBtn = document.getElementById("reload");

const viewList = document.getElementById("view-list");
const viewPdf = document.getElementById("view-pdf");
const backBtn = document.getElementById("back");

const pdfTitleEl = document.getElementById("pdfTitle");
const openHereBtn = document.getElementById("openHere");
const openNew = document.getElementById("openNew");
const download = document.getElementById("download");

let all = [];
let current = null;

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function showList() {
  viewPdf.style.display = "none";
  viewList.style.display = "";
  current = null;
  // czyścimy hash, żeby po odświeżeniu nie wracało do panelu
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
}

function openPdfSameTab(file) {
  // iOS/PWA: najbardziej przewidywalne zachowanie + działa cofanie
  window.open(file, "_self");
}

function showPdfPanel(item) {
  current = item;

  viewList.style.display = "none";
  viewPdf.style.display = "";

  pdfTitleEl.textContent = item.title;

  // ustaw linki
  openNew.href = item.file;
  download.href = item.file;

  // przycisk otwarcia w tej samej karcie
  openHereBtn.onclick = (e) => {
    e.preventDefault();
    openPdfSameTab(item.file);
  };

  // stan/historia dla przycisku „Wstecz” w panelu
  history.pushState({ page: "panel", file: item.file }, "", `#panel=${encodeURIComponent(item.file)}`);
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

    // Klik: pokazujemy panel, a PDF otwierasz dopiero po kliknięciu "Otwórz"
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

    restorePanelFromHash();
  } catch (e) {
    setStatus("Nie udało się wczytać pdfs.json. Sprawdź czy plik istnieje i jest poprawnym JSON-em.");
    console.error(e);
  }
}

function restorePanelFromHash() {
  const m = location.hash.match(/^#panel=(.+)$/);
  if (!m) return;

  const file = decodeURIComponent(m[1]);
  const found = all.find(x => x.file === file);
  if (found) showPdfPanel(found);
}

qEl.addEventListener("input", render);
reloadBtn.addEventListener("click", () => loadList({ bypassCache: true }));

backBtn.addEventListener("click", () => history.back());

window.addEventListener("popstate", (ev) => {
  const st = ev.state;
  if (!st || st.page === "list") showList();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

// iOS: agresywny cache — bierz świeże pdfs.json na starcie
history.replaceState({ page: "list" }, "", location.pathname + location.search);
loadList({ bypassCache: true });
