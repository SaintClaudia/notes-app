const { useState, useEffect, useRef, useCallback, useLayoutEffect } = React;
const DEFAULT_CATEGORIES = ["Work", "Tasks", "Ideas", "Lists"];
const storageAdapter = {
  async get(key) {
    try {
      const v = localStorage.getItem("notesapp_" + key);
      return v === null ? null : { key, value: v };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem("notesapp_" + key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  }
};
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function newBlock(type = "text", text = "") {
  return { id: uid(), type, text };
}
function newNote() {
  return { id: uid(), title: "", category: "", archived: false, blocks: [], updatedAt: Date.now() };
}
function isNoteEmpty(n) {
  if (n.title && n.title.trim()) return false;
  return !n.blocks.some((b) => b.text && b.text.trim());
}
function noteSnippet(n) {
  const parts = n.blocks.filter((b) => !b.done && b.text && b.text.trim()).map((b) => (b.type === "check" ? "\u25CB " : "") + b.text.trim());
  return parts.join("  \xB7  ") || "Empty note";
}
function noteActiveCount(n) {
  return n.blocks.filter((b) => b.type === "check" && !b.done && b.text && b.text.trim()).length;
}
function noteMatchesSearch(n, q) {
  if (!q) return true;
  const hay = (n.title + " " + n.category + " " + n.blocks.map((b) => b.text).join(" ")).toLowerCase();
  return hay.includes(q.toLowerCase());
}
const Icon = {
  grid: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "3", width: "8", height: "8", rx: "1.5" }), /* @__PURE__ */ React.createElement("rect", { x: "13", y: "3", width: "8", height: "8", rx: "1.5" }), /* @__PURE__ */ React.createElement("rect", { x: "3", y: "13", width: "8", height: "8", rx: "1.5" }), /* @__PURE__ */ React.createElement("rect", { x: "13", y: "13", width: "8", height: "8", rx: "1.5" })),
  plus: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), /* @__PURE__ */ React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })),
  list: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "6", x2: "21", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "12", x2: "21", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "18", x2: "21", y2: "18" }), /* @__PURE__ */ React.createElement("circle", { cx: "4", cy: "6", r: "1.3", fill: "currentColor", stroke: "none" }), /* @__PURE__ */ React.createElement("circle", { cx: "4", cy: "12", r: "1.3", fill: "currentColor", stroke: "none" }), /* @__PURE__ */ React.createElement("circle", { cx: "4", cy: "18", r: "1.3", fill: "currentColor", stroke: "none" })),
  back: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }), /* @__PURE__ */ React.createElement("polyline", { points: "12 19 5 12 12 5" })),
  check: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3" }, /* @__PURE__ */ React.createElement("polyline", { points: "20 6 9 17 4 12" })),
  trash: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })),
  archive: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "4", rx: "1" }), /* @__PURE__ */ React.createElement("path", { d: "M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" }), /* @__PURE__ */ React.createElement("line", { x1: "10", y1: "12", x2: "14", y2: "12" })),
  restore: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("path", { d: "M3 12a9 9 0 1 0 3-6.7" }), /* @__PURE__ */ React.createElement("polyline", { points: "3 4 3 9 8 9" })),
  search: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("circle", { cx: "11", cy: "11", r: "7" }), /* @__PURE__ */ React.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })),
  mic: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("rect", { x: "9", y: "2", width: "6", height: "12", rx: "3" }), /* @__PURE__ */ React.createElement("path", { d: "M5 10v1a7 7 0 0 0 14 0v-1" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "18", x2: "12", y2: "22" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "22", x2: "16", y2: "22" })),
  send: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "19", x2: "12", y2: "5" }), /* @__PURE__ */ React.createElement("polyline", { points: "6 11 12 5 18 11" })),
  key: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "15", r: "5" }), /* @__PURE__ */ React.createElement("line", { x1: "13", y1: "10", x2: "22", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "19", y1: "10", x2: "19", y2: "13" }))
};
function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
function App() {
  const [tab, setTab] = useState("dashboard");
  const [notes, setNotes] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [editingId, setEditingId] = useState(null);
  const [viewingArchive, setViewingArchive] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  useEffect(() => {
    (async () => {
      let loadedNotes = [];
      try {
        const r = await storageAdapter.get("notes_v2");
        loadedNotes = r ? JSON.parse(r.value) : [];
      } catch (e) {
      }
      try {
        const c = await storageAdapter.get("categories_v1");
        setCategories(c ? JSON.parse(c.value) : DEFAULT_CATEGORIES);
      } catch (e) {
        setCategories(DEFAULT_CATEGORIES);
      }
      const n = newNote();
      const next = [n, ...loadedNotes];
      setNotes(next);
      setEditingId(n.id);
      try {
        await storageAdapter.set("notes_v2", JSON.stringify(next));
      } catch (e) {
      }
    })();
  }, []);
  const persist = useCallback(async (next) => {
    setNotes(next);
    try {
      const r = await storageAdapter.set("notes_v2", JSON.stringify(next));
      if (!r) setStorageOk(false);
    } catch (e) {
      setStorageOk(false);
    }
  }, []);
  const persistCategories = useCallback(async (next) => {
    setCategories(next);
    try {
      await storageAdapter.set("categories_v1", JSON.stringify(next));
    } catch (e) {
    }
  }, []);
  if (notes === null) {
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "40px", color: "var(--muted)" } }, "loading", /* @__PURE__ */ React.createElement("span", { className: "cursor-blink" }));
  }
  function openNewNote() {
    const n = newNote();
    persist([n, ...notes]);
    setEditingId(n.id);
  }
  function openNote(id) {
    setEditingId(id);
  }
  function closeEditor() {
    const current = notes.find((n) => n.id === editingId);
    if (current && isNoteEmpty(current)) {
      persist(notes.filter((n) => n.id !== editingId));
    }
    setEditingId(null);
  }
  function updateNote(id, patch) {
    persist(notes.map((n) => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));
  }
  function archiveNote(id) {
    updateNote(id, { archived: true });
    setEditingId(null);
  }
  function restoreNote(id) {
    updateNote(id, { archived: false });
    setEditingId(null);
  }
  function deleteForever(id) {
    persist(notes.filter((n) => n.id !== id));
    setEditingId(null);
  }
  function addCategory(name) {
    const clean = name.trim();
    if (!clean || categories.includes(clean)) return clean;
    persistCategories([...categories, clean]);
    return clean;
  }
  const editingNote = editingId ? notes.find((n) => n.id === editingId) : null;
  function navigate(newTab) {
    closeEditor();
    setTab(newTab);
  }
  function saveAndViewNotes() {
    closeEditor();
    setTab("notes");
  }
  return /* @__PURE__ */ React.createElement("div", { className: "shell" }, /* @__PURE__ */ React.createElement("div", { className: "screen" }, editingNote ? /* @__PURE__ */ React.createElement(
    Editor,
    {
      note: editingNote,
      categories,
      onChange: (patch) => updateNote(editingNote.id, patch),
      onAddCategory: addCategory,
      onBack: closeEditor,
      onSave: saveAndViewNotes,
      onArchive: () => archiveNote(editingNote.id),
      onRestore: () => restoreNote(editingNote.id),
      onDeleteForever: () => deleteForever(editingNote.id)
    }
  ) : viewingArchive ? /* @__PURE__ */ React.createElement(ArchiveList, { notes, onOpenNote: openNote, onBack: () => setViewingArchive(false) }) : tab === "dashboard" ? /* @__PURE__ */ React.createElement(
    Dashboard,
    {
      notes,
      categories,
      storageOk,
      onOpenNote: openNote
    }
  ) : /* @__PURE__ */ React.createElement(NotesList, { notes, categories, onOpenNote: openNote, onOpenArchive: () => setViewingArchive(true) })), !viewingArchive && /* @__PURE__ */ React.createElement("div", { className: "bottom-nav" }, /* @__PURE__ */ React.createElement("div", { className: "nav-item" + (!editingNote && tab === "dashboard" ? " active" : ""), onClick: () => navigate("dashboard") }, Icon.grid, /* @__PURE__ */ React.createElement("span", { className: "nav-label" }, "dashboard")), /* @__PURE__ */ React.createElement("div", { className: "nav-item", onClick: openNewNote }, /* @__PURE__ */ React.createElement("button", { className: "nav-create-btn" }, Icon.plus)), /* @__PURE__ */ React.createElement("div", { className: "nav-item" + (!editingNote && tab === "notes" ? " active" : ""), onClick: () => navigate("notes") }, Icon.list, /* @__PURE__ */ React.createElement("span", { className: "nav-label" }, "notes"))));
}
function Dashboard({ notes, categories, storageOk, onOpenNote }) {
  const [activeFilter, setActiveFilter] = useState(null);
  const realNotes = notes.filter((n) => !n.archived && !isNoteEmpty(n));
  const totalTasks = realNotes.reduce((a, n) => a + noteActiveCount(n), 0);
  const catCounts = categories.map((cat) => ({ cat, count: realNotes.filter((n) => n.category === cat).length })).filter((b) => b.count > 0);
  const filteredNotes = activeFilter ? realNotes.filter((n) => n.category === activeFilter) : realNotes;
  function buildSummary() {
    if (realNotes.length === 0) return "No notes yet \u2014 tap + to start one.";
    const parts = [
      `${realNotes.length} note${realNotes.length !== 1 ? "s" : ""}, ${totalTasks} active task${totalTasks !== 1 ? "s" : ""}.`
    ];
    if (catCounts.length > 0) {
      parts.push(catCounts.map((b) => `${b.cat}: ${b.count}`).join(" \xB7 ") + ".");
    }
    const recent = [...realNotes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (recent) {
      const diff = Date.now() - recent.updatedAt;
      const when = diff < 6e4 ? "just now" : diff < 36e5 ? `${Math.floor(diff / 6e4)}m ago` : diff < 864e5 ? `${Math.floor(diff / 36e5)}h ago` : new Date(recent.updatedAt).toLocaleDateString();
      parts.push(`Last updated: "${recent.title || "Untitled"}" ${when}.`);
    }
    return parts.join("\n");
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "topbar" }, /* @__PURE__ */ React.createElement("div", { className: "brand" }, /* @__PURE__ */ React.createElement("span", { className: "dot" }), "notes")), !storageOk && /* @__PURE__ */ React.createElement("div", { className: "empty-msg", style: { color: "var(--danger)" } }, "storage error \u2014 changes may not save"), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-title" }, /* @__PURE__ */ React.createElement("h2", null, "summary")), /* @__PURE__ */ React.createElement("div", { className: "summary-box" + (realNotes.length === 0 ? " placeholder" : "") }, buildSummary())), catCounts.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "cat-filter-grid" }, catCounts.map((b) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: b.cat,
      className: "cat-filter-chip" + (activeFilter === b.cat ? " active" : ""),
      style: catCounts.length === 1 ? { gridColumn: "1 / -1" } : {},
      onClick: () => setActiveFilter(activeFilter === b.cat ? null : b.cat)
    },
    /* @__PURE__ */ React.createElement("div", { className: "num" }, b.count),
    /* @__PURE__ */ React.createElement("div", { className: "label" }, b.cat)
  ))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-title" }, /* @__PURE__ */ React.createElement("h2", null, activeFilter || "recent"), activeFilter && /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: () => setActiveFilter(null), title: "clear filter" }, "\u2715")), filteredNotes.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty-msg" }, activeFilter ? `No notes tagged "${activeFilter}".` : "No notes yet \u2014 tap + to start one."), [...filteredNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5).map((n) => /* @__PURE__ */ React.createElement("div", { className: "note-card", key: n.id, onClick: () => onOpenNote(n.id), style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "title" }, n.title || "Untitled"), /* @__PURE__ */ React.createElement("div", { className: "snippet" }, noteSnippet(n)), /* @__PURE__ */ React.createElement("div", { className: "meta-row" }, /* @__PURE__ */ React.createElement("span", { className: "meta" }, n.category && /* @__PURE__ */ React.createElement("span", { className: "cat-tag" }, n.category)), noteActiveCount(n) > 0 && /* @__PURE__ */ React.createElement("span", { className: "badge" }, noteActiveCount(n), " active"))))));
}
function NotesList({ notes, categories, onOpenNote, onOpenArchive }) {
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState(null);
  const allReal = notes.filter((n) => !n.archived && !isNoteEmpty(n));
  const usedCats = categories.filter((cat) => allReal.some((n) => n.category === cat));
  const realNotes = allReal.filter((n) => (!activeFilter || n.category === activeFilter) && noteMatchesSearch(n, q)).sort((a, b) => b.updatedAt - a.updatedAt);
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "topbar" }, /* @__PURE__ */ React.createElement("div", { className: "brand" }, /* @__PURE__ */ React.createElement("span", { className: "dot" }), "notes"), /* @__PURE__ */ React.createElement("div", { className: "topbar-actions" }, /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: onOpenArchive, title: "archive" }, Icon.archive))), /* @__PURE__ */ React.createElement("div", { className: "search-box" }, Icon.search, /* @__PURE__ */ React.createElement("input", { type: "text", placeholder: "Search notes...", value: q, onChange: (e) => setQ(e.target.value) })), usedCats.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "filter-chips" }, usedCats.map((cat) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: cat,
      className: "filter-chip" + (activeFilter === cat ? " active" : ""),
      onClick: () => setActiveFilter(activeFilter === cat ? null : cat)
    },
    cat
  ))), realNotes.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty-msg" }, q || activeFilter ? "No matches." : "No notes yet."), realNotes.map((n) => /* @__PURE__ */ React.createElement("div", { className: "note-card", key: n.id, onClick: () => onOpenNote(n.id) }, /* @__PURE__ */ React.createElement("div", { className: "title" }, n.title || "Untitled"), /* @__PURE__ */ React.createElement("div", { className: "snippet" }, noteSnippet(n)), /* @__PURE__ */ React.createElement("div", { className: "meta-row" }, /* @__PURE__ */ React.createElement("span", { className: "meta" }, new Date(n.updatedAt).toLocaleDateString(), n.category && /* @__PURE__ */ React.createElement("span", { className: "cat-tag" }, n.category)), noteActiveCount(n) > 0 && /* @__PURE__ */ React.createElement("span", { className: "badge" }, noteActiveCount(n), " active")))));
}
function ArchiveList({ notes, onOpenNote, onBack }) {
  const archived = notes.filter((n) => n.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "topbar" }, /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: onBack }, Icon.back), /* @__PURE__ */ React.createElement("div", { className: "brand" }, "archive")), archived.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty-msg" }, "Archive is empty."), archived.map((n) => /* @__PURE__ */ React.createElement("div", { className: "note-card", key: n.id, onClick: () => onOpenNote(n.id) }, /* @__PURE__ */ React.createElement("div", { className: "title" }, n.title || "Untitled"), /* @__PURE__ */ React.createElement("div", { className: "snippet" }, noteSnippet(n)), /* @__PURE__ */ React.createElement("div", { className: "meta-row" }, /* @__PURE__ */ React.createElement("span", { className: "meta" }, new Date(n.updatedAt).toLocaleDateString(), n.category && /* @__PURE__ */ React.createElement("span", { className: "cat-tag" }, n.category))))));
}
function CategoryPicker({ categories, value, onSelect, onAddCategory }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);
  function submit() {
    const name = onAddCategory(draft);
    if (name) onSelect(value === name ? "" : name);
    setDraft("");
    setAdding(false);
  }
  return /* @__PURE__ */ React.createElement("div", { className: "cat-row" }, categories.map((c) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: c,
      className: "cat-pick" + (value === c ? " selected" : ""),
      onClick: () => onSelect(value === c ? "" : c)
    },
    c
  )), adding ? /* @__PURE__ */ React.createElement(
    "input",
    {
      ref: inputRef,
      className: "cat-new-input",
      placeholder: "Category name",
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          setAdding(false);
          setDraft("");
        }
      },
      onBlur: submit
    }
  ) : /* @__PURE__ */ React.createElement("div", { className: "cat-pick add", onClick: () => setAdding(true) }, "+ new"));
}
function Editor({ note, categories, onChange, onAddCategory, onBack, onSave, onArchive, onRestore, onDeleteForever }) {
  const [blocks, setBlocks] = useState(note.blocks);
  const [title, setTitle] = useState(note.title);
  const [category, setCategory] = useState(note.category || "");
  const [leaving, setLeaving] = useState({});
  const [focusTarget, setFocusTarget] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const refs = useRef({});
  const recognitionRef = useRef(null);
  const composerRef = useRef(null);
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micSupported = !!SpeechRecognitionCtor;
  useEffect(() => {
    onChange({ title, blocks, category });
  }, [title, blocks, category]);
  useLayoutEffect(() => {
    Object.values(refs.current).forEach(autoGrow);
  }, [blocks]);
  useEffect(() => {
    if (focusTarget && refs.current[focusTarget.id]) {
      const el = refs.current[focusTarget.id];
      el.focus();
      const pos = focusTarget.pos ?? el.value.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch (e) {
      }
      setFocusTarget(null);
    }
  }, [focusTarget, blocks]);
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
        }
      }
    };
  }, []);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function updatePos() {
      if (!composerRef.current) return;
      const keyboardH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      composerRef.current.style.bottom = (keyboardH > 10 ? keyboardH + 16 : 130) + "px";
    }
    vv.addEventListener("resize", updatePos);
    vv.addEventListener("scroll", updatePos);
    updatePos();
    return () => {
      vv.removeEventListener("resize", updatePos);
      vv.removeEventListener("scroll", updatePos);
    };
  }, []);
  function addBlock() {
    const b = newBlock("text", "");
    setBlocks((prev) => [...prev, b]);
    setFocusTarget({ id: b.id, pos: 0 });
  }
  function setBlockText(id, text) {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      if (b.type === "text" && text.startsWith("- ")) return { ...b, type: "check", text: text.slice(2) };
      return { ...b, text };
    }));
  }
  function completeBlock(id) {
    setLeaving((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, done: true } : b));
      setLeaving((prev) => {
        const p = { ...prev };
        delete p[id];
        return p;
      });
    }, 220);
  }
  function uncompleteBlock(id) {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, done: false } : b));
  }
  function handleBlockKeyDown(e, block, index) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (block.type === "check" && block.text === "") {
        const b = newBlock("text", "");
        setBlocks((prev) => {
          const next = [...prev];
          next.splice(index, 1, b);
          return next;
        });
        setFocusTarget({ id: b.id, pos: 0 });
      } else {
        const b = newBlock(block.type, "");
        setBlocks((prev) => {
          const next = [...prev];
          next.splice(index + 1, 0, b);
          return next;
        });
        setFocusTarget({ id: b.id, pos: 0 });
      }
    }
    if (e.key === "Backspace") {
      const el = e.target;
      if (el.selectionStart === 0 && el.selectionEnd === 0 && block.text === "") {
        if (index === 0) return;
        e.preventDefault();
        setBlocks((prev) => {
          const prevBlock = prev[index - 1];
          const next = [...prev];
          next.splice(index, 1);
          setFocusTarget({ id: prevBlock.id, pos: prevBlock.text.length });
          return next;
        });
      }
    }
  }
  function toggleMic() {
    if (!micSupported) return;
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      return;
    }
    const recog = new SpeechRecognitionCtor();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = navigator.language || "en-US";
    let accumulated = "";
    recog.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) accumulated += (accumulated ? " " : "") + e.results[i][0].transcript;
      }
    };
    recog.onerror = () => setIsListening(false);
    recog.onend = () => {
      setIsListening(false);
      if (!accumulated.trim()) return;
      const additions = accumulated.split("\n").filter((l) => l.trim()).map((line) => {
        const t = line.replace(/^\s+/, "");
        return t.startsWith("- ") ? newBlock("check", t.slice(2)) : newBlock("text", line);
      });
      if (additions.length) setBlocks((prev) => [...prev, ...additions]);
    };
    recognitionRef.current = recog;
    recog.start();
    setIsListening(true);
  }
  const activeBlocks = blocks.filter((b) => !b.done);
  const completedBlocks = blocks.filter((b) => b.done);
  return /* @__PURE__ */ React.createElement("div", { className: "editor-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "editor-topbar" }, /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: onBack }, Icon.back), note.archived ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: onRestore, title: "restore" }, Icon.restore), /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: onDeleteForever, title: "delete forever" }, Icon.trash)) : /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: onArchive, title: "archive" }, Icon.archive)), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      className: "editor-title",
      placeholder: "Title",
      value: title,
      onChange: (e) => setTitle(e.target.value)
    }
  ), note.archived && /* @__PURE__ */ React.createElement("div", { className: "archive-banner" }, "This note is archived. Restore it to keep editing, or delete it for good."), /* @__PURE__ */ React.createElement(CategoryPicker, { categories, value: category, onSelect: setCategory, onAddCategory }), /* @__PURE__ */ React.createElement("div", { className: "editor-body", onClick: (e) => {
    if (e.target === e.currentTarget) addBlock();
  } }, activeBlocks.length === 0 && completedBlocks.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty-msg", style: { cursor: "text" }, onClick: addBlock }, "Tap to start writing..."), activeBlocks.map((block) => {
    const i = blocks.findIndex((b) => b.id === block.id);
    return /* @__PURE__ */ React.createElement("div", { className: "block-row" + (leaving[block.id] ? " leaving" : ""), key: block.id }, block.type === "check" && /* @__PURE__ */ React.createElement("div", { className: "block-check" + (leaving[block.id] ? " checked" : ""), onClick: () => completeBlock(block.id) }, Icon.check), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        ref: (el) => {
          if (el) {
            refs.current[block.id] = el;
          } else {
            delete refs.current[block.id];
          }
        },
        className: "block-text",
        rows: 1,
        value: block.text,
        onChange: (e) => {
          setBlockText(block.id, e.target.value);
          autoGrow(e.target);
        },
        onKeyDown: (e) => handleBlockKeyDown(e, block, i)
      }
    ));
  }), completedBlocks.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "completed-section" }, /* @__PURE__ */ React.createElement("div", { className: "completed-header", onClick: () => setShowCompleted((v) => !v) }, showCompleted ? "\u25BE" : "\u25B8", " Completed (", completedBlocks.length, ")"), showCompleted && completedBlocks.map((block) => /* @__PURE__ */ React.createElement("div", { className: "block-row", key: block.id }, /* @__PURE__ */ React.createElement("div", { className: "block-check checked", onClick: () => uncompleteBlock(block.id) }, Icon.check), /* @__PURE__ */ React.createElement("div", { className: "block-text block-text-done" }, block.text))))), /* @__PURE__ */ React.createElement("div", { className: "compose-bar", ref: composerRef }, isListening && /* @__PURE__ */ React.createElement("span", { className: "listening-label" }, "listening\u2026"), micSupported && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "mic-btn" + (isListening ? " listening" : ""),
      onClick: toggleMic,
      title: isListening ? "stop dictation" : "dictate"
    },
    Icon.mic
  ), /* @__PURE__ */ React.createElement("button", { className: "send-btn", onClick: onSave, title: "save & view notes" }, Icon.send)));
}
ReactDOM.createRoot(document.getElementById("app-root")).render(/* @__PURE__ */ React.createElement(App, null));
