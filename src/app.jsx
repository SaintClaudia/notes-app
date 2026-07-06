const { useState, useEffect, useRef, useCallback, useLayoutEffect } = React;

const DEFAULT_CATEGORIES = ['Ideas', 'Lists', 'Tasks', 'Work'];

const storageAdapter = {
  async get(key) {
    try {
      const v = localStorage.getItem('notesapp_' + key);
      return v === null ? null : { key, value: v };
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      localStorage.setItem('notesapp_' + key, value);
      return { key, value };
    } catch (e) { return null; }
  }
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function newBlock(type = 'text', text = '') { return { id: uid(), type, text }; }
function newNote() { return { id: uid(), title: '', category: '', archived: false, private: false, blocks: [], updatedAt: Date.now() }; }

function isNoteEmpty(n) {
  if (n.title && n.title.trim()) return false;
  return !n.blocks.some(b => b.text && b.text.trim());
}

function noteSnippet(n) {
  const parts = n.blocks.filter(b => !b.done && b.text && b.text.trim()).map(b => (b.type === 'check' ? '○ ' : '') + b.text.trim());
  return parts.join('  ·  ') || 'Empty note';
}

function noteActiveCount(n) {
  return n.blocks.filter(b => b.type === 'check' && !b.done && b.text && b.text.trim()).length;
}

function noteMatchesSearch(n, q) {
  if (!q) return true;
  const hay = (n.title + ' ' + n.category + ' ' + n.blocks.map(b => b.text).join(' ')).toLowerCase();
  return hay.includes(q.toLowerCase());
}

/* ---------- icons ---------- */
const Icon = {
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  archive: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  restore: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  mic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>,
  key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="15" r="5"/><line x1="13" y1="10" x2="22" y2="10"/><line x1="19" y1="10" x2="19" y2="13"/></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
};

function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/* ---------- App ---------- */
function App() {
  const [tab, setTab] = useState('dashboard');
  const [notes, setNotes] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [editingId, setEditingId] = useState(null);
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    (async () => {
      let loadedNotes = [];
      try {
        const r = await storageAdapter.get('notes_v2');
        loadedNotes = r ? JSON.parse(r.value) : [];
      } catch (e) {}
      try {
        const c = await storageAdapter.get('categories_v1');
        setCategories(c ? JSON.parse(c.value) : DEFAULT_CATEGORIES);
      } catch (e) { setCategories(DEFAULT_CATEGORIES); }

      // Always open a fresh note on launch
      const n = newNote();
      const next = [n, ...loadedNotes];
      setNotes(next);
      setEditingId(n.id);
      try { await storageAdapter.set('notes_v2', JSON.stringify(next)); } catch (e) {}
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setNotes(next);
    try {
      const r = await storageAdapter.set('notes_v2', JSON.stringify(next));
      if (!r) setStorageOk(false);
    } catch (e) { setStorageOk(false); }
  }, []);

  const persistCategories = useCallback(async (next) => {
    setCategories(next);
    try { await storageAdapter.set('categories_v1', JSON.stringify(next)); } catch (e) {}
  }, []);


  if (notes === null) {
    return <div style={{ padding: '40px', color: 'var(--muted)' }}>loading<span className="cursor-blink"></span></div>;
  }

  function openNewNote() {
    const n = newNote();
    persist([n, ...notes]);
    setEditingId(n.id);
  }

  function openNote(id) { setEditingId(id); }

  function closeEditor() {
    const current = notes.find(n => n.id === editingId);
    if (current && isNoteEmpty(current)) {
      persist(notes.filter(n => n.id !== editingId));
    }
    setEditingId(null);
  }

  function updateNote(id, patch) {
    persist(notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));
  }

  function deleteNote(id) { persist(notes.filter(n => n.id !== id)); setEditingId(null); }
  function deleteMany(ids) { persist(notes.filter(n => !ids.has(n.id))); }

  function addCategory(name) {
    const clean = name.trim();
    if (!clean || categories.includes(clean)) return clean;
    persistCategories([...categories, clean]);
    return clean;
  }

  function renameCategory(oldName, newName) {
    const clean = newName.trim();
    if (!clean || clean === oldName || categories.includes(clean)) return;
    persistCategories(categories.map(c => c === oldName ? clean : c));
    persist(notes.map(n => n.category === oldName ? { ...n, category: clean } : n));
  }

  function deleteCategory(name) {
    persistCategories(categories.filter(c => c !== name));
    persist(notes.map(n => n.category === name ? { ...n, category: '' } : n));
  }

  const editingNote = editingId ? notes.find(n => n.id === editingId) : null;

  function navigate(newTab) {
    closeEditor();
    setTab(newTab);
  }

  function saveAndViewNotes() {
    closeEditor();
    setTab('notes');
  }

  return (
    <div className="shell">
      <div className="screen">
        {editingNote ? (
          <Editor note={editingNote} categories={categories}
            onChange={patch => updateNote(editingNote.id, patch)}
            onAddCategory={addCategory}
            onRenameCategory={renameCategory}
            onDeleteCategory={deleteCategory}
            onBack={closeEditor}
            onSave={saveAndViewNotes} />
        ) : tab === 'dashboard' ? (
          <Dashboard notes={notes} categories={categories} storageOk={storageOk}
            onOpenNote={openNote} />
        ) : (
          <NotesList notes={notes} categories={categories} onOpenNote={openNote} onDeleteMany={deleteMany} />
        )}
      </div>

      <div className="bottom-nav">
          <div className={'nav-item' + (!editingNote && tab === 'dashboard' ? ' active' : '')} onClick={() => navigate('dashboard')}>
            {Icon.grid}<span className="nav-label">dashboard</span>
          </div>
          <div className="nav-item" onClick={openNewNote}>
            <button className="nav-create-btn">{Icon.plus}</button>
          </div>
          <div className={'nav-item' + (!editingNote && tab === 'notes' ? ' active' : '')} onClick={() => navigate('notes')}>
            {Icon.list}<span className="nav-label">notes</span>
          </div>
        </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ notes, categories, storageOk, onOpenNote }) {
  const [activeFilter, setActiveFilter] = useState(null);
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
  }

  const realNotes = notes.filter(n => !n.archived && !isNoteEmpty(n));
  const totalTasks = realNotes.reduce((a, n) => a + noteActiveCount(n), 0); // used in summary text

  const catCounts = categories
    .map(cat => ({ cat, count: realNotes.filter(n => n.category === cat).length }))
    .filter(b => b.count > 0);

  const filteredNotes = activeFilter ? realNotes.filter(n => n.category === activeFilter) : realNotes;

  function buildSummary() {
    if (realNotes.length === 0) return 'No notes yet — tap + to start one.';
    const visible = realNotes.filter(n => !n.private);
    if (visible.length === 0) return 'All notes are set to private.';

    const sorted = [...visible].sort((a, b) => b.updatedAt - a.updatedAt);
    const tasks = visible.flatMap(n =>
      n.blocks.filter(b => b.type === 'check' && !b.done && b.text?.trim())
    ).map(b => b.text.trim());

    function noteTitle(n) {
      return n.title?.trim() || n.blocks.find(b => b.text?.trim())?.text.trim() || 'an untitled note';
    }
    function noteDesc(n) {
      const title = n.title?.trim();
      const first = n.blocks.find(b => !b.done && b.text?.trim())?.text.trim() || '';
      if (title && first) return `${title} — ${first}`;
      return title || first || 'an untitled note';
    }

    const [recent, ...rest] = sorted;
    const parts = [];

    parts.push(`You were last working on ${noteDesc(recent)}.`);

    if (rest.length === 1) {
      parts.push(`You also have ${noteTitle(rest[0])}.`);
    } else if (rest.length === 2) {
      parts.push(`You also have ${noteTitle(rest[0])} and ${noteTitle(rest[1])}.`);
    } else if (rest.length > 2) {
      parts.push(`You also have ${noteTitle(rest[0])}, ${noteTitle(rest[1])}, and ${rest.length - 2} more.`);
    }

    if (tasks.length === 1) {
      parts.push(`Still to do: ${tasks[0]}.`);
    } else if (tasks.length === 2) {
      parts.push(`Still to do: ${tasks[0]} and ${tasks[1]}.`);
    } else if (tasks.length >= 3) {
      parts.push(`Still to do: ${tasks.slice(0, 2).join(', ')}, and ${tasks.length - 2} more.`);
    }

    return parts.join(' ');
  }

  return (
    <div>
      <div className="topbar">
        <div className="brand"><span className="dot"></span>notes</div>
      </div>
      {!storageOk && <div className="empty-msg" style={{ color: 'var(--danger)' }}>storage error — changes may not save</div>}

      <div className="summary-section">
        <div className="summary-section-header">
          <span className="summary-section-label">summary</span>
          <button className="icon-btn-plain" onClick={handleRefresh} title="refresh">
            <span className={spinning ? 'spin' : ''}>{Icon.refresh}</span>
          </button>
        </div>
        <div className={'summary-text' + (realNotes.length === 0 ? ' placeholder' : '')}>
          {buildSummary()}
        </div>
      </div>

      {catCounts.length > 0 && (
        <div className="cat-filter-grid">
          {catCounts.map(b => (
            <div
              key={b.cat}
              className={'cat-filter-chip' + (activeFilter === b.cat ? ' active' : '')}
              style={catCounts.length === 1 ? { gridColumn: '1 / -1' } : {}}
              onClick={() => setActiveFilter(activeFilter === b.cat ? null : b.cat)}
            >
              <div className="num">{b.count}</div>
              <div className="label">{b.cat}</div>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-title">
          <h2>{activeFilter || 'recent'}</h2>
          {activeFilter && (
            <button className="icon-btn-plain" onClick={() => setActiveFilter(null)} title="clear filter">✕</button>
          )}
        </div>
        {filteredNotes.length === 0 && (
          <div className="empty-msg">{activeFilter ? `No notes tagged "${activeFilter}".` : 'No notes yet — tap + to start one.'}</div>
        )}
        {[...filteredNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5).map(n => (
          <div className="note-card" key={n.id} onClick={() => onOpenNote(n.id)} style={{ marginBottom: 8 }}>
            <div className="note-card-body">
              <div className="title">{n.title || 'Untitled'}</div>
              <div className="snippet">{noteSnippet(n)}</div>
              <div className="meta-row">
                <span className="meta">{n.category && <span className="cat-tag">{n.category}</span>}</span>
                {noteActiveCount(n) > 0 && <span className="badge">{noteActiveCount(n)} active</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Notes list ---------- */
function NotesList({ notes, categories, onOpenNote, onDeleteMany }) {
  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const allReal = notes.filter(n => !n.archived && !isNoteEmpty(n));
  const usedCats = categories.filter(cat => allReal.some(n => n.category === cat));
  const realNotes = allReal
    .filter(n => (!activeFilter || n.category === activeFilter) && noteMatchesSearch(n, q))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitEdit() { setIsEditing(false); setSelected(new Set()); }

  function handleDelete() {
    onDeleteMany(selected);
    exitEdit();
  }

  function handleCardTap(id) {
    if (isEditing) { toggleSelect(id); } else { onOpenNote(id); }
  }

  return (
    <div>
      <div className="topbar">
        <div className="brand"><span className="dot"></span>notes</div>
        <div className="topbar-actions">
          {isEditing ? (
            <>
              {selected.size > 0 && (
                <button className="icon-btn-plain" style={{ color: 'var(--danger)' }}
                  onClick={handleDelete} title="delete selected">
                  {Icon.trash}
                </button>
              )}
              <button className="icon-btn-plain" onClick={exitEdit}>done</button>
            </>
          ) : (
            <button className="icon-btn-plain" onClick={() => setIsEditing(true)}>edit</button>
          )}
        </div>
      </div>
      {!isEditing && (
        <div className="search-box">
          {Icon.search}
          <input type="text" placeholder="Search notes..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
      )}
      {!isEditing && usedCats.length > 0 && (
        <div className="filter-chips">
          {usedCats.map(cat => (
            <div key={cat} className={'filter-chip' + (activeFilter === cat ? ' active' : '')}
              onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}>
              {cat}
            </div>
          ))}
        </div>
      )}
      {isEditing && selected.size > 0 && (
        <div className="bulk-bar">
          {selected.size} selected
        </div>
      )}
      {realNotes.length === 0 && <div className="empty-msg">{q || activeFilter ? 'No matches.' : 'No notes yet.'}</div>}
      {realNotes.map(n => (
        <div className={'note-card' + (isEditing && selected.has(n.id) ? ' selected' : '')}
          key={n.id} onClick={() => handleCardTap(n.id)}>
          {isEditing && (
            <div className={'select-circle' + (selected.has(n.id) ? ' checked' : '')} />
          )}
          <div className="note-card-body">
            <div className="title">{n.title || 'Untitled'}</div>
            <div className="snippet">{noteSnippet(n)}</div>
            <div className="meta-row">
              <span className="meta">
                {new Date(n.updatedAt).toLocaleDateString()}
                {n.category && <span className="cat-tag">{n.category}</span>}
              </span>
              {noteActiveCount(n) > 0 && <span className="badge">{noteActiveCount(n)} active</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Category picker ---------- */
function CategoryPicker({ categories, value, onSelect, onAddCategory, onRenameCategory, onDeleteCategory }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const inputRef = useRef(null);
  const rowRef = useRef(null);
  const pressTimer = useRef(null);
  const didLongPress = useRef(false);

  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 4);
  }, [categories, expanded]);

  function submit() {
    const name = onAddCategory(draft);
    if (name) onSelect(value === name ? '' : name);
    setDraft('');
    setAdding(false);
  }

  function startPress(cat) {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setEditingCat(cat);
      setEditDraft(cat);
    }, 500);
  }

  function cancelPress() { clearTimeout(pressTimer.current); }

  function handleChipClick(cat) {
    if (didLongPress.current) { didLongPress.current = false; return; }
    onSelect(value === cat ? '' : cat);
  }

  function confirmRename() {
    const clean = editDraft.trim();
    if (clean && clean !== editingCat) {
      onRenameCategory(editingCat, clean);
      if (value === editingCat) onSelect(clean);
    }
    setEditingCat(null);
  }

  function handleDeleteCat(cat) {
    if (value === cat) onSelect('');
    onDeleteCategory(cat);
    setEditingCat(null);
  }

  return (
    <div>
    <div ref={rowRef} className={'cat-row' + (!expanded ? ' collapsed' : '')}>
      {categories.map(c => (
        editingCat === c ? (
          <div key={c} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input className="cat-new-input" autoFocus value={editDraft}
              onChange={e => setEditDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditingCat(null); }}
              onBlur={confirmRename} />
            <button className="icon-btn-plain" style={{ color: 'var(--danger)', padding: '2px' }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleDeleteCat(c)}>
              {Icon.trash}
            </button>
          </div>
        ) : (
          <div key={c} className={'cat-pick' + (value === c ? ' selected' : '')}
            onClick={() => handleChipClick(c)}
            onMouseDown={() => startPress(c)}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onTouchStart={() => startPress(c)}
            onTouchEnd={cancelPress}
            onContextMenu={e => e.preventDefault()}>
            {c}
          </div>
        )
      ))}
      {adding ? (
        <input ref={inputRef} className="cat-new-input" placeholder="Category name" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
          onBlur={submit} />
      ) : (
        <div className="cat-pick add" onClick={() => setAdding(true)}>+ new</div>
      )}
    </div>
    {(overflows || expanded) && (
      <button className="cat-show-more" onClick={() => setExpanded(v => !v)}>
        {expanded ? 'show less ▴' : 'show more ▾'}
      </button>
    )}
    </div>
  );
}

/* ---------- Editor ---------- */
function Editor({ note, categories, onChange, onAddCategory, onRenameCategory, onDeleteCategory, onBack, onSave }) {
  const [blocks, setBlocks] = useState(note.blocks);
  const [title, setTitle] = useState(note.title);
  const [category, setCategory] = useState(note.category || '');
  const [isPrivate, setIsPrivate] = useState(note.private || false);
  const [leaving, setLeaving] = useState({});
  const [focusTarget, setFocusTarget] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const refs = useRef({});
  const composerRef = useRef(null);

  useEffect(() => { onChange({ title, blocks, category, private: isPrivate }); }, [title, blocks, category, isPrivate]);
  useLayoutEffect(() => { Object.values(refs.current).forEach(autoGrow); }, [blocks]);

  useEffect(() => {
    if (focusTarget && refs.current[focusTarget.id]) {
      const el = refs.current[focusTarget.id];
      el.focus();
      const pos = focusTarget.pos ?? el.value.length;
      try { el.setSelectionRange(pos, pos); } catch (e) {}
      setFocusTarget(null);
    }
  }, [focusTarget, blocks]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function updatePos() {
      if (!composerRef.current) return;
      const keyboardH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      composerRef.current.style.bottom = (keyboardH > 10 ? keyboardH + 16 : 130) + 'px';
    }
    vv.addEventListener('resize', updatePos);
    vv.addEventListener('scroll', updatePos);
    updatePos();
    return () => { vv.removeEventListener('resize', updatePos); vv.removeEventListener('scroll', updatePos); };
  }, []);

  function addBlock() {
    const b = newBlock('text', '');
    setBlocks(prev => [...prev, b]);
    setFocusTarget({ id: b.id, pos: 0 });
  }

  function setBlockText(id, text) {
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b;
      if (b.type === 'text' && text.startsWith('- ')) return { ...b, type: 'check', text: text.slice(2) };
      return { ...b, text };
    }));
  }

  function completeBlock(id) {
    setLeaving(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, done: true } : b));
      setLeaving(prev => { const p = { ...prev }; delete p[id]; return p; });
    }, 220);
  }

  function uncompleteBlock(id) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, done: false } : b));
  }

  function handleBlockKeyDown(e, block, index) {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Empty checklist block + Enter: remove the circle and replace with a text block
      if (block.type === 'check' && block.text === '') {
        const b = newBlock('text', '');
        setBlocks(prev => {
          const next = [...prev];
          next.splice(index, 1, b);
          return next;
        });
        setFocusTarget({ id: b.id, pos: 0 });
      } else {
        const b = newBlock(block.type, '');
        setBlocks(prev => {
          const next = [...prev];
          next.splice(index + 1, 0, b);
          return next;
        });
        setFocusTarget({ id: b.id, pos: 0 });
      }
    }
    if (e.key === 'Backspace') {
      const el = e.target;
      if (el.selectionStart === 0 && el.selectionEnd === 0 && block.text === '') {
        if (index === 0) return;
        e.preventDefault();
        setBlocks(prev => {
          const prevBlock = prev[index - 1];
          const next = [...prev];
          next.splice(index, 1);
          setFocusTarget({ id: prevBlock.id, pos: prevBlock.text.length });
          return next;
        });
      }
    }
  }

  const activeBlocks = blocks.filter(b => !b.done);
  const completedBlocks = blocks.filter(b => b.done);

  return (
    <div className="editor-wrap">


      <div className="editor-header">
        <button className={'privacy-btn' + (isPrivate ? ' active' : '')}
          onClick={() => setIsPrivate(v => !v)}>
          {isPrivate ? Icon.eyeOff : Icon.eye}
          {isPrivate && <span className="privacy-label">hidden from summary</span>}
        </button>
      </div>

      <input type="text" className="editor-title" placeholder="Title"
        value={title} onChange={e => setTitle(e.target.value)} />

      <CategoryPicker categories={categories} value={category} onSelect={setCategory}
        onAddCategory={onAddCategory} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory} />

      <div className="editor-body" onClick={e => { if (e.target === e.currentTarget) addBlock(); }}>
        {activeBlocks.length === 0 && completedBlocks.length === 0 && (
          <div className="empty-msg" style={{ cursor: 'text' }} onClick={addBlock}>Tap to start writing...</div>
        )}
        {activeBlocks.map(block => {
          const i = blocks.findIndex(b => b.id === block.id);
          return (
            <div className={'block-row' + (leaving[block.id] ? ' leaving' : '')} key={block.id}>
              {block.type === 'check' && (
                <div className={'block-check' + (leaving[block.id] ? ' checked' : '')} onClick={() => completeBlock(block.id)}>
                  {Icon.check}
                </div>
              )}
              <textarea
                ref={el => { if (el) { refs.current[block.id] = el; } else { delete refs.current[block.id]; } }}
                className="block-text"
                rows={1}
                value={block.text}
                onChange={e => { setBlockText(block.id, e.target.value); autoGrow(e.target); }}
                onKeyDown={e => handleBlockKeyDown(e, block, i)}
              />
            </div>
          );
        })}
        {completedBlocks.length > 0 && (
          <div className="completed-section">
            <div className="completed-header" onClick={() => setShowCompleted(v => !v)}>
              {showCompleted ? '▾' : '▸'} Completed ({completedBlocks.length})
            </div>
            {showCompleted && completedBlocks.map(block => (
              <div className="block-row" key={block.id}>
                <div className="block-check checked" onClick={() => uncompleteBlock(block.id)}>
                  {Icon.check}
                </div>
                <div className="block-text block-text-done">{block.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="compose-bar" ref={composerRef}>
        <button className="send-btn" onClick={onSave} title="save & view notes">
          {Icon.send}
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app-root')).render(<App />);
