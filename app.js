// app.js — manuale by Landek (PDF.js viewer na iOS + animacje)

const TESTER_URL = "https://landekkk.github.io/tester-dymkow-pwa/";

// PDF.js setup
const pdfjsLib = window["pdfjs-dist/build/pdf"];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.js";

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
const pdfCanvas = document.getElementById("pdfCanvas");
const thumbStrip = document.getElementById("thumbStrip");

const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const pageNowEl = document.getElementById("pageNow");
const pageTotalEl = document.getElementById("pageTotal");

const openTesterCard = document.getElementById("openTester");
const testerFrame = document.getElementById("testerFrame");

let all = [];
let activeView = viewList;

// PDF state
let pdfDoc = null;
let pageNum = 1;
let zoom = 1;        // user zoom factor
let baseScale = 1;   // fit-to-width base
let rendering = false;
let pendingPage = null;
let currentFile = null;

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
  };

  prev.addEventListener("transitionend", onDone);
  setTimeout(onDone, 260);

  activeView = next;
}

function showList() {
  switchView(viewList);
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
}

function showTesterPanel() {
  if (!testerFrame.src) testerFrame.src = TESTER_URL;
  switchView(viewTester);
  history.pushState({ page: "tester" }, "", "#tester");
}

/* ===== PDF.js rendering ===== */

function updateControls() {
  if (!pdfDoc) return;
  pageNowEl.textContent = String(pageNum);
  pageTotalEl.textContent = String(pdfDoc.numPages);
  prevPageBtn.disabled = pageNum <= 1;
  nextPageBtn.disabled = pageNum >= pdfDoc.numPages;
}

function getFitScale(viewportWidth, pageViewportWidth) {
  const padding = 0; // canvasWrap już ma padding w stage
  const usable = Math.max(320, viewportWidth - padding);
  return usable / pageViewportWidth;
}

async function renderPage(num) {
  if (!pdfDoc) return;

  rendering = true;
  pageNum = num;
  updateControls();

  const page = await pdfDoc.getPage(num);

  // Fit-to-width + user zoom
  const unscaled = page.getViewport({ scale: 1 });

  // szerokość wrappera = szerokość canvas w CSS (100% parenta)
  const wrap = pdfCanvas.parentElement;
  const wrapWidth = wrap.clientWidth || 360;

  baseScale = getFitScale(wrapWidth, unscaled.width);
  const scale = baseScale * zoom;

  const viewport = page.getViewport({ scale });

  const ctx = pdfCanvas.getContext("2d", { alpha: false });

  // ustaw rozdzielczość canvas
  pdfCanvas.width = Math.floor(viewport.width);
  pdfCanvas.height = Math.floor(viewport.height);

  // rysuj
  await page.render({ canvasContext: ctx, viewport }).promise;

  // zaznacz aktywną miniaturkę
  [...thumbStrip.querySelectorAll(".thumb")].forEach(el => {
    el.classList.toggle("is-active", Number(el.dataset.page) === pageNum);
  });

  rendering = false;

  if (pendingPage !== null) {
    const p = pendingPage;
    pendingPage = null;
    renderPage(p);
  }
}

function queueRenderPage(num) {
  if (rendering) pendingPage = num;
  else renderPage(num);
}

async function buildThumbnails() {
  thumbStrip.innerHTML = "";
  if (!pdfDoc) return;

  const total = pdfDoc.numPages;

  for (let i = 1; i <= total; i++) {
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.dataset.page = String(i);

    const c = document.createElement("canvas");
    thumb.appendChild(c);
    thumbStrip.appendChild(thumb);

    // Click -> go to page
    thumb.addEventListener("click", () => queueRenderPage(i));

    // render thumbnail
    const page = await pdfDoc.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });

    const targetW = 96; // CSS width
    const scale = targetW / vp1.width;
    const vp = page.getViewport({ scale });

    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);

    const tctx = c.getContext("2d", { alpha: false });
    await page.render({ canvasContext: tctx, viewport: vp }).promise;
  }
}

async function openPdfInApp(file, title) {
  currentFile = file;
  pdfTitleEl.textContent = title || "PDF";

  // reset state
  pdfDoc = null;
  pageNum = 1;
  zoom = 1;
  pendingPage = null;
  thumbStrip.innerHTML = "";

  switchView(viewPdf);

  try {
    // important: cache-bust w iOS czasem pomaga, ale tylko dla listy — PDFy mogą być duże,
    // więc tu nie dokładamy ?t=... (zostawiamy czyste URL)
    const loadingTask = pdfjsLib.getDocument({ url: file });
    pdfDoc = await loadingTask.promise;

    pageTotalEl.textContent = String(pdfDoc.numPages);
    await buildThumbnails();
    await renderPage(1);

    history.pushState({ page: "pdf", file }, "", `#pdf=${encodeURIComponent(file)}`);
  } catch (e) {
    console.error(e);
    alert("Nie udało się otworzyć PDF. Jeśli problem wraca, sprawdź nazwę pliku i ścieżkę.");
    showList();
  }
}

/* ===== Lista PDF ===== */

function renderList() {
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
      openPdfInApp(item.file, item.title);
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

    renderList();
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
  if (found) openPdfInApp(found.file, found.title);
}

/* ===== Events ===== */

qEl.addEventListener("input", renderList);
reloadBtn.addEventListener("click", () => loadList({ bypassCache: true }));

backPdfBtn.addEventListener("click", () => history.back());
backTesterBtn.addEventListener("click", () => history.back());

openTesterCard.addEventListener("click", showTesterPanel);
openTesterCard.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") showTesterPanel();
});

// PDF controls
prevPageBtn.addEventListener("click", () => queueRenderPage(Math.max(1, pageNum - 1)));
nextPageBtn.addEventListener("click", () => queueRenderPage(Math.min(pdfDoc?.numPages || 1, pageNum + 1)));

zoomInBtn.addEventListener("click", () => {
  zoom = Math.min(3, Number((zoom + 0.15).toFixed(2)));
  queueRenderPage(pageNum);
});
zoomOutBtn.addEventListener("click", () => {
  zoom = Math.max(0.6, Number((zoom - 0.15).toFixed(2)));
  queueRenderPage(pageNum);
});

// Re-render on orientation change / resize (fit width)
window.addEventListener("resize", () => {
  if (activeView === viewPdf && pdfDoc) queueRenderPage(pageNum);
});

window.addEventListener("popstate", (ev) => {
  const st = ev.state;
  if (!st || st.page === "list") showList();
  else if (st.page === "pdf") {
    const found = all.find(x => x.file === st.file);
    if (found) openPdfInApp(found.file, found.title);
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
