// app.js — Biblioteka PDF (iOS-friendly, bez iframe)

const listEl = document.getElementById("list");
const qEl = document.getElementById("q");
const metaEl = document.getElementById("meta");
const statusEl = document.getElementById("status");
const reloadBtn = document.getElementById("reload");

const viewList = document.getElementById("view-list");
const viewPdf = document.getElementById("view-pdf");
const backBtn = document.getElementById("back");
const pdfTitleEl = document.getElementById("pdfTitle");
const openNew = document.getElementById("openNew");
const download = document.getElementById("download");

let all = [];

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function showList() {
  viewPdf.style.display = "none";
  viewList.style.display = "";
}

function showPdfPanel(item) {
  // Panel zostawiamy tylko jako “szczegóły” + przyciski (bez podglądu iframe)
  viewList.style.display = "none";
  viewPdf.style.display = "";

  pdfTitleEl.textContent = item.title;
  openNew.href = item.file;
  download.href = item.file;
}

function openPdfSameTab(file) {
  // iOS/PWA: najbardziej przewidywalne dla “cofnij” to _self
  window.open(file, "_self");
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

    // Klik w tytuł: otwieramy PDF w tej samej karcie (systemowy viewer iOS)
    a.addEventListener("click", (e) => {
      e.preventDefault();
      // opcjonalnie: pokazuj panel przez ułamek sekundy (np. gdybyś chciał mieć przyciski)
      // showPdfPanel(item);

      openPdfSameTab(item.file);
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
  } catch (e) {
    setStatus("Nie udało się wczytać pdfs.json. Sprawdź czy plik istnieje i jest poprawnym JSON-em.");
    console.error(e);
  }
}

qEl.addEventListener("input", render);
reloadBtn.addEventListener("click", () => loadList({ bypassCache: true }));

// Wstecz w panelu (jeśli go kiedyś użyjesz)
backBtn.addEventListener("click", () => showList());

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

// Na iOS potrafi cachować agresywnie — na start wymuś świeże pdfs.json
loadList({ bypassCache: true });
