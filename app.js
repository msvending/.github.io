document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // Required elements
  const canvas = $("canvas");
  const libraryEl = $("library");
  const statusEl = $("status");

  const wInput = $("wInput");
  const hInput = $("hInput");
  const layoutInput = $("layoutInput");

  const dimLabel = $("dimLabel");
  const gridLabel = $("gridLabel");

  const fileInput = $("fileInput");
  const urlInput = $("urlInput");
  const addUrlBtn = $("addUrlBtn");

  const applyBtn = $("applyBtn");
  const saveBtn = $("saveBtn");
  const loadBtn = $("loadBtn");
  const exportBtn = $("exportBtn");
  const clearBtn = $("clearBtn");

  const exportDialog = $("exportDialog");
  const exportText = $("exportText");
  const copyBtn = $("copyBtn");

  // Hard fail early if any required ID is missing
  const missing = [];
  for (const [name, el] of Object.entries({
    canvas, libraryEl, statusEl,
    wInput, hInput, layoutInput,
    dimLabel, gridLabel,
    fileInput, urlInput, addUrlBtn,
    applyBtn, saveBtn, loadBtn, exportBtn, clearBtn,
    exportDialog, exportText, copyBtn
  })) {
    if (!el) missing.push(name);
  }
  if (missing.length) {
    console.error("Missing elements:", missing);
    alert("HTML/JS mismatch. Missing IDs: " + missing.join(", "));
    return;
  }

  const STORAGE_KEY = "planogram_builder_v2";

  let state = {
    canvas: { width: 1240, height: 2438, rowLayout: [3,3,3,3,3,3] },
    library: [], // {id, src, name}
    items: []    // {id, src, x, y, w, h, section:{r,c}}
  };

  const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

  function setStatus(msg) {
    statusEl.textContent = msg;
    console.log("[Planogram]", msg);
  }

  // Helpers
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function clampInt(v, min, max) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return min;
    return clamp(n, min, max);
  }
  function safeParseJSON(s){ try { return JSON.parse(s); } catch { return null; } }
  function truncate(s, n){ return s.length > n ? s.slice(0, n-1) + "…" : s; }
  function escapeHtml(s){
    return (s || "").replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[m]));
  }
  function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // Layout parsing
  function parseRowLayout(text) {
    const parts = (text || "")
      .split(/[, ]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const nums = parts.map(p => clampInt(p, 1, 200));
    return nums.length ? nums : [3,3,3,3,3,3];
  }

  function buildSections() {
    const { width, height, rowLayout } = state.canvas;
    const rows = rowLayout.length;
    const rowH = height / rows;

    const sections = [];
    for (let r = 0; r < rows; r++) {
      const cols = rowLayout[r];
      const colW = width / cols;
      for (let c = 0; c < cols; c++) {
        sections.push({ r, c, x: c * colW, y: r * rowH, w: colW, h: rowH });
      }
    }
    return sections;
  }

  function getSectionForPoint(x, y) {
    const { width, height, rowLayout } = state.canvas;

    const cx = clamp(x, 0, width - 1);
    const cy = clamp(y, 0, height - 1);

    const rows = rowLayout.length;
    const rowH = height / rows;
    const r = clamp(Math.floor(cy / rowH), 0, rows - 1);

    const cols = rowLayout[r];
    const colW = width / cols;
    const c = clamp(Math.floor(cx / colW), 0, cols - 1);

    return { r, c };
  }

  // Rendering
  function renderSections() {
    [...canvas.querySelectorAll(".section")].forEach(el => el.remove());

    for (const s of buildSections()) {
      const sec = document.createElement("div");
      sec.className = "section";
      sec.style.left = `${s.x}px`;
      sec.style.top = `${s.y}px`;
      sec.style.width = `${s.w}px`;
      sec.style.height = `${s.h}px`;

      const label = document.createElement("div");
      label.className = "sectionLabel";
      label.textContent = `R${s.r + 1} S${s.c + 1}`;
      sec.appendChild(label);

      canvas.appendChild(sec);
    }
  }

  function renderLibrary() {
    libraryEl.innerHTML = "";

    for (const li of state.library) {
      const card = document.createElement("div");
      card.className = "libItem";
      card.draggable = true;

      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ type: "library", id: li.id }));
      });

      const thumb = document.createElement("div");
      thumb.className = "libThumb";
      const img = document.createElement("img");
      img.src = li.src;
      img.alt = li.name;
      thumb.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "libMeta";
      meta.innerHTML = `<span title="${escapeHtml(li.name)}">${truncate(li.name, 18)}</span><span class="badge">drag</span>`;

      card.appendChild(thumb);
      card.appendChild(meta);

      libraryEl.appendChild(card);
    }
  }

  function renderItems() {
    [...canvas.querySelectorAll(".item")].forEach(el => el.remove());

    for (const it of state.items) {
      const el = document.createElement("div");
      el.className = "item";
      el.style.left = `${it.x}px`;
      el.style.top = `${it.y}px`;
      el.style.width = `${it.w}px`;
      el.style.height = `${it.h}px`;
      el.dataset.id = it.id;
      el.title = `R${it.section.r + 1} S${it.section.c + 1}`;

      const img = document.createElement("img");
      img.src = it.src;
      img.draggable = false;
      el.appendChild(img);

      el.addEventListener("dblclick", () => {
        state.items = state.items.filter(x => x.id !== it.id);
        renderItems();
      });

      enablePointerDrag(el);
      canvas.appendChild(el);
    }
  }

  function enablePointerDrag(el) {
    let startX = 0, startY = 0, baseX = 0, baseY = 0;
    const id = el.dataset.id;

    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      const it = state.items.find(x => x.id === id);
      if (!it) return;
      startX = e.clientX; startY = e.clientY;
      baseX = it.x; baseY = it.y;
    });

    el.addEventListener("pointermove", (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      const it = state.items.find(x => x.id === id);
      if (!it) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      it.x = clamp(baseX + dx, 0, state.canvas.width - it.w);
      it.y = clamp(baseY + dy, 0, state.canvas.height - it.h);
      it.section = getSectionForPoint(it.x + it.w/2, it.y + it.h/2);

      el.style.left = `${it.x}px`;
      el.style.top = `${it.y}px`;
      el.title = `R${it.section.r + 1} S${it.section.c + 1}`;
    });

    el.addEventListener("pointerup", (e) => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    });
  }

  function applyCanvasSettings() {
    const width = clampInt(wInput.value, 200, 20000);
    const height = clampInt(hInput.value, 200, 20000);
    const rowLayout = parseRowLayout(layoutInput.value);

    state.canvas = { width, height, rowLayout };

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    dimLabel.textContent = `${width} × ${height}`;
    gridLabel.textContent = rowLayout.join(",");

    renderSections();

    // clamp items and refresh section
    state.items.forEach(it => {
      it.x = clamp(it.x, 0, width - it.w);
      it.y = clamp(it.y, 0, height - it.h);
      it.section = getSectionForPoint(it.x + it.w/2, it.y + it.h/2);
    });

    renderItems();
    setStatus(`Applied ${width}×${height} | Layout ${rowLayout.join(",")}`);
  }

  // Add library items
  function addLibraryItem(src, name="Item") {
    state.library.unshift({ id: uid(), src, name });
    renderLibrary();
  }

  // Drag/drop into canvas
  canvas.addEventListener("dragover", (e) => e.preventDefault());
  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const data = safeParseJSON(e.dataTransfer.getData("text/plain"));
    if (!data || data.type !== "library") return;

    const lib = state.library.find(l => l.id === data.id);
    if (!lib) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const section = getSectionForPoint(x, y);

    state.items.push({
      id: uid(),
      src: lib.src,
      x: clamp(x - 55, 0, state.canvas.width - 110),
      y: clamp(y - 55, 0, state.canvas.height - 110),
      w: 110,
      h: 110,
      section
    });

    renderItems();
  });

  // Upload
  fileInput.addEventListener("change", async () => {
    const files = [...(fileInput.files || [])];
    for (const f of files) addLibraryItem(await fileToDataUrl(f), f.name);
    fileInput.value = "";
  });

  // URL
  addUrlBtn.addEventListener("click", () => {
    const url = (urlInput.value || "").trim();
    if (!url) return;
    addLibraryItem(url, url);
    urlInput.value = "";
  });

  // Save/Load/Export/Clear
  function saveToLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus("Saved.");
  }
  function loadFromLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = safeParseJSON(raw);
    if (!parsed?.canvas?.rowLayout) return false;

    state = parsed;
    wInput.value = state.canvas.width;
    hInput.value = state.canvas.height;
    layoutInput.value = state.canvas.rowLayout.join(",");

    applyCanvasSettings();
    renderLibrary();
    renderItems();
    setStatus("Loaded.");
    return true;
  }
  function exportJSON() {
    const payload = {
      canvas: state.canvas,
      items: state.items.map(i => ({
        id: i.id, src: i.src,
        x: Math.round(i.x), y: Math.round(i.y),
        w: Math.round(i.w), h: Math.round(i.h),
        section: i.section
      }))
    };
    exportText.value = JSON.stringify(payload, null, 2);
    exportDialog.showModal();
  }

  applyBtn.addEventListener("click", applyCanvasSettings);
  saveBtn.addEventListener("click", saveToLocal);
  loadBtn.addEventListener("click", () => { if (!loadFromLocal()) alert("No saved layout found yet."); });
  exportBtn.addEventListener("click", exportJSON);
  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear canvas items?")) return;
    state.items = [];
    renderItems();
    setStatus("Cleared canvas items.");
  });

  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(exportText.value || "");
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 900);
  });

  // Local demo images (no external DNS calls)
  const svgData = (label) =>
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
        <rect width="100%" height="100%" fill="#0f172a"/>
        <rect x="24" y="24" width="352" height="352" rx="24" fill="#111c33" stroke="#23314a"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
          font-family="system-ui,Segoe UI,Arial" font-size="42" fill="#93a4b8">${label}</text>
      </svg>
    `);

  // Init
  setStatus("JS loaded.");
  addLibraryItem(svgData("Item A"), "Item A");
  addLibraryItem(svgData("Item B"), "Item B");
  renderLibrary();
  applyCanvasSettings();
});
