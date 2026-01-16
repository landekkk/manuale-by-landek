const listEl = document.getElementById("list");
const qEl = document.getElementById("q");
const metaEl = document.getElementById("meta");
const statusEl = document.getElementById("status");
const reloadBtn = document.getElementById("reload");

const viewList = document.getElementById("view-list");
const viewPdf = document.getElementById("view-pdf");
const backBtn = document.getElementById("back");
const frame = document.getElementById("frame");
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
  pdfTitleEl.textContent = "";
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
}

function showPdf(item) {
  viewList.style.display = "none";
  viewPdf.style.display = "";

  pdfTitleEl.textContent = item.title;

  openNew.href = item.file;

  // iOS: "download" często i tak otworzy podgląd, ale zostawmy atrybut download
  download.href = item.file;

  // Najważniejsze: otwórz PDF w systemowym viewer Safari (działa dobrze na iOS)
  // Otwieramy w tej samej karcie, żeby użytkownik mógł wrócić "Wstecz"
  window.location.href = item.file;

  history.pushState(
    { page: "pdf", file: item.file, title: item.title },
    "",
    `#pdf=${encodeURIComponent(item.file)}`
  );
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
      showPdf(item);
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
  // Jeżeli ktoś wejdzie bezpośrednio w link z #pdf=...
  const m = location.hash.match(/^#pdf=(.+)$/);
  if (!m) return;

  const file = decodeURIComponent(m[1]);
  const found = all.find(x => x.file === file);
  if (found) showPdf(found);
}

qEl.addEventListener("input", render);
reloadBtn.addEventListener("click", () => loadList({ bypassCache: true }));
backBtn.addEventListener("click", () => history.back());

window.addEventListener("popstate", (ev) => {
  // Wstecz z PDF → lista
  const st = ev.state;
  if (!st || st.page === "list") showList();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

// start
history.replaceState({ page: "list" }, "", location.pathname + location.search);
loadList();
