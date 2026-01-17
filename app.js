// app.js — manuale by Landek (PDF podgląd w apce + animacje)

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
const pdfFrame = document.getElementById("pdfFrame");

const openTesterCard = document.getElementById("openTester");
const testerFrame = document.getElementById("testerFrame");

let all = [];
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

function clearPdfFrame() {
  // czyścimy, żeby PDF nie „wisiał” w pamięci po powrocie
  pdfFrame.removeAttribute("src");
}

function switchView(next) {
  if (next === activeView) return;

  const prev = activeView;

  next.classList.add("is-active");
  setAriaHidden(next, false);

  requestAnimationFrame(() => {
    next.classList.add("is-visible");
    prev.classList.remove("is-visible");
  });

  const onDone = () => {
    prev.classList.remove("is-active");
    setAriaHidden(prev, true);
    prev.removeEventListener("transitionend", onDone);

    // sprzątanie po widokach
    if (prev === viewPdf) clearPdfFrame();
  };

  prev.addEventListener("transitionend", onDone);
  setTimeout(onDone, 260);

  activeView = next;
}

function showList() {
  switchView(viewList);
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
}

function showPdf(item) {
  pdfTitleEl.textContent = item.title;

  // Tip: dodajemy #view=FitH — czasem lepiej startuje
  const src = item.file + "#view=FitH";
  pdfFrame.src = src;

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
  if (location.hash === "#tester") {
    showTesterPanel();
    return;
  }

  const m = location.hash.match(/^#pdf=(.+)$/);
  if (!m) return;

  const file = decodeURIComponent(m[1]);
  const found = all.find(x => x.file === file);
  if (found) showPdf(found);
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
    if (found) showPdf(found);
    else showList();
  } else if (st.page === "tester") showTesterPanel();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

// start
viewList.classList.add("is-active");
requestAnimationFrame(() => viewList.classList.add("is-visible"));

history.replaceState({ page: "list" }, "", location.pathname + location.search);
loadList({ bypassCache: true });
