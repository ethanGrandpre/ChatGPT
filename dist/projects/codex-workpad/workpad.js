const KEY = 'dock-codex-workpad-v1';
const MAX_NOTES = 100;
const $ = (id) => document.getElementById(id);
const instructionInput = $('instructions');
const noteInput = $('new-note');
const notesEl = $('notes');
let state = readState();
let editingId = null;

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      instructions: typeof parsed.instructions === 'string' ? parsed.instructions.slice(0, 50000) : '',
      notes: Array.isArray(parsed.notes) ? parsed.notes.filter((n) => n && typeof n.id === 'string' && typeof n.text === 'string').slice(0, MAX_NOTES) : [],
    };
  } catch { return { instructions: '', notes: [] }; }
}

function persist(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    $('save-state').textContent = 'Saved on this browser';
    return true;
  } catch {
    $('save-state').textContent = 'Could not save — browser storage is full';
    return false;
  }
}

function render() {
  instructionInput.value = state.instructions;
  $('instruction-count').textContent = `${state.instructions.length.toLocaleString()} characters`;
  notesEl.replaceChildren();
  $('copy-notes').disabled = !state.notes.length;
  if (!state.notes.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Your completion notes will collect here.';
    notesEl.append(empty);
    return;
  }
  for (const note of state.notes) {
    const card = document.createElement('article');
    card.className = 'note';
    const head = document.createElement('div');
    head.className = 'note-head';
    const date = document.createElement('time');
    const timestamp = Number(note.updatedAt || note.createdAt);
    date.dateTime = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
    date.textContent = Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'Saved note';
    if (note.updatedAt && note.updatedAt !== note.createdAt) date.textContent += ' · edited';
    const tools = document.createElement('div');
    tools.className = 'note-tools';
    const edit = button(editingId === note.id ? 'Cancel' : 'Edit', () => {
      editingId = editingId === note.id ? null : note.id;
      render();
    });
    const remove = button('Delete', () => {
      if (!confirm('Delete this completion note?')) return;
      persist({ ...state, notes: state.notes.filter((item) => item.id !== note.id) });
      if (editingId === note.id) editingId = null;
      render();
    });
    tools.append(edit, remove);
    head.append(date, tools);
    card.append(head);
    if (editingId === note.id) {
      const editor = document.createElement('textarea');
      editor.className = 'edit-note';
      editor.maxLength = 10000;
      editor.setAttribute('aria-label', 'Edit completion note');
      editor.value = note.text;
      const save = button('Save note', () => {
        const text = editor.value.trim();
        if (!text) { editor.focus(); return; }
        if (persist({ ...state, notes: state.notes.map((item) => item.id === note.id ? { ...item, text, updatedAt: Date.now() } : item) })) {
          editingId = null;
          render();
        }
      });
      save.className = 'primary';
      card.append(editor, save);
    } else {
      const text = document.createElement('p');
      text.className = 'note-text';
      text.textContent = note.text;
      card.append(text);
    }
    notesEl.append(card);
  }
}

function button(label, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

async function copy(text, status) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied';
  } catch {
    status.textContent = 'Clipboard unavailable — select and copy the text';
  }
  setTimeout(() => { status.textContent = ''; }, 2500);
}

instructionInput.addEventListener('input', () => {
  $('instruction-count').textContent = `${instructionInput.value.length.toLocaleString()} characters`;
  $('save-state').textContent = 'Saving…';
  clearTimeout(instructionInput.saveTimer);
  instructionInput.saveTimer = setTimeout(() => persist({ ...state, instructions: instructionInput.value }), 250);
});

$('copy-instructions').addEventListener('click', () => copy(instructionInput.value.trim(), $('save-state')));
$('clear-instructions').addEventListener('click', () => {
  if (!instructionInput.value || !confirm('Clear the Codex instructions?')) return;
  clearTimeout(instructionInput.saveTimer);
  if (persist({ ...state, instructions: '' })) render();
});
$('add-note').addEventListener('click', () => {
  const text = noteInput.value.trim();
  if (!text) { noteInput.focus(); return; }
  if (state.notes.length >= MAX_NOTES) { $('note-status').textContent = 'Delete an older note before adding another'; return; }
  const now = Date.now();
  if (persist({ ...state, notes: [{ id: crypto.randomUUID(), text, createdAt: now }, ...state.notes] })) {
    noteInput.value = '';
    $('note-status').textContent = 'Note saved';
    render();
    setTimeout(() => { $('note-status').textContent = ''; }, 2500);
  }
});
$('copy-notes').addEventListener('click', () => copy(state.notes.map((note) => `${new Date(note.createdAt).toLocaleString()}\n${note.text}`).join('\n\n---\n\n'), $('note-status')));
noteInput.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') $('add-note').click();
});
$('theme').addEventListener('click', () => window.DockAppearance?.toggleTheme());
render();
