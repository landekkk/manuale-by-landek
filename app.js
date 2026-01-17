(() => {
  const TESTER_URL = "https://landekkk.github.io/tester-dymkow-pwa/";

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);

  function setText(el, txt) {
    if (el) el.textContent = txt ?? "";
  }

  const statusEl = $("status");
  function setStatus(msg) {
    setText(statusEl, msg || "");
  }

  // Pokaż błędy na ekranie (żeby nie było “ciszy”)
  window.addEventListener("error", (e) => {
    setStatus("Błąd aplikacji: " + (e?.message || "unknown"));
  });
  window.addEventListener("unhandledrejection", (e) => {
    setStatus("Błąd aplikacji: " + (e?.reason?.message || String(e?.reason || "unknown")));
  });

  // ===== Elements (mogą być null – obsługujemy) =====
  const listEl = $("list");
  const qEl = $("q");
  const metaEl = $("meta");
  const reloadBtn = $("reload");

  const viewList = $("view-list");
  const viewPdf = $("view-pdf");
  const viewTester = $("view-tester");

  const backPdfBtn = $("backPdf");
  const backTesterBtn = $("backTester");

  const pdfTitleEl = $("pdfTitle");
  const pdfCanvas = $("pdfCanvas");
  const thumbStrip = $("thumbStrip");

  const prevPageBtn = $("prevPage");
  const nextPageBtn = $("nextPage");
  const zoomInBtn = $("zoomIn");
  const zoomOutBtn = $("zoomOut");
  const pageNowEl = $("pageNow");
  const pageTotalEl = $("pageTotal");

  const openTesterCard = $("openTester");
  const testerFrame = $("testerFrame");

  // Jeżeli kluczowe elementy listy nie istnieją — pokaż błąd od razu
  if (!listEl || !qEl || !metaEl || !reloadBtn || !viewList) {
    setStatus("Brakuje elementów w index.html (list/q/meta/reload/view-list).");
    return;
  }

  // ===== View switching (fade/slide) =====
  let activeView = viewList;

  function setAriaHidden(el, hidden) {
    if (el) el.setAttribute("aria-hidden", hidden ? "true" : "false");
  }

  function switchView(next) {
    if (!next || next === activeView) return;
    const prev = activeView;

    next.classList.add("is-active");
    setAriaHidden(next, false);

    requestAnimationFrame(() => {
      next.classList.add("is-visible");
      prev?.classList.remove("is-visible");
    });

    const onDone = () => {
      prev?.classList.remove("is-active");
      setAriaHidden(prev, true);
      prev?.removeEventListener("transitionend", onDone);
    };

    prev?.addEventListener("transitionend", onDone);
    setTimeout(onDone, 260);

    activeView = next;
  }

  function showList() {
    switchView(viewList);
    history.replaceState({ page: "list" }, "", location.pathname + location.search);
  }

  function showTesterPanel() {
    // jeśli nie mamy iframe albo view-tester, to fallback: otwórz w nowej karcie
    if (!viewTester || !testerFrame) {
      window.open(TESTER_URL, "_blank");
      return;
    }
    if (!testerFrame.src) testerFrame.src = TESTER_URL;
    switchView(viewTester);
    history.pushState({ page: "tester" }, "", "#tester");
  }

  // ===== Load pdfs.json (to ma działać zawsze) =====
  let all = [];

  function normalize(s) {
    return (s || "").toLowerCase().trim();
  }

  function renderList() {
    const q = normalize(qEl.value);
    const filtered = all.filter(x => normalize(x.title).includes(q));

    listEl.innerHTML = "";
    setText(metaEl, `Pozycji: ${filtered.length}${q ? ` (filtr: „${qEl.value}”)` : ""}`);

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

      // Na razie: otwieramy PDF systemowo (żeby lista + tester na pewno działały).
      // PDF.js dołożymy po ustabilizowaniu (w następnym kroku).
      a.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(item.file, "_blank");
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
      console.error(e);
      setStatus("Nie udało się wczytać pdfs.json (błąd w JSON lub cache).");
    }
  }

  function restoreFromHash() {
    if (location.hash === "#tester") {
      showTesterPanel();
      return;
    }
  }

  // ===== Events (bez ryzyka null crash) =====
  qEl.addEventListener("input", renderList);
  reloadBtn.addEventListener("click", () => loadList({ bypassCache: true }));

  if (backPdfBtn) backPdfBtn.addEventListener("click", () => history.back());
  if (backTesterBtn) backTesterBtn.addEventListener("click", () => history.back());

  if (openTesterCard) {
    openTesterCard.addEventListener("click", showTesterPanel);
    openTesterCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") showTesterPanel();
    });
  }

  window.addEventListener("popstate", (ev) => {
    const st = ev.state;
    if (!st || st.page === "list") showList();
    else if (st.page === "tester") showTesterPanel();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  }

  // Start
  setStatus("");
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
  loadList({ bypassCache: true });
})();
