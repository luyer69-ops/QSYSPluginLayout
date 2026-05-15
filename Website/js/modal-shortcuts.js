const SHORTCUTS = [
  {
    group: 'Selection',
    items: [
      { keys: 'Click', action: 'Select object' },
      { keys: 'Shift + Click', action: 'Toggle selection' },
      { keys: 'Drag (empty area)', action: 'Rubber-band select' },
      { keys: 'Ctrl + A', action: 'Select all' },
      { keys: 'Escape', action: 'Clear selection' },
    ],
  },
  {
    group: 'Editing',
    items: [
      { keys: 'Ctrl + Z', action: 'Undo' },
      { keys: 'Ctrl + Y / Ctrl + Shift + Z', action: 'Redo' },
      { keys: 'Ctrl + C', action: 'Copy' },
      { keys: 'Ctrl + V', action: 'Paste' },
      { keys: 'Ctrl + D', action: 'Duplicate' },
      { keys: 'Delete / Backspace', action: 'Delete selected' },
      { keys: 'Double-click', action: 'Focus Name / Text field' },
    ],
  },
  {
    group: 'Movement & Resize',
    items: [
      { keys: 'Arrow keys', action: 'Move (1 grid step)' },
      { keys: 'Ctrl + Arrow', action: 'Move (1 px)' },
      { keys: 'Shift + Arrow', action: 'Resize (1 grid step)' },
      { keys: 'Drag handle', action: 'Resize freely' },
    ],
  },
  {
    group: 'Alignment',
    items: [
      { keys: 'Ctrl + Shift + ←', action: 'Align left' },
      { keys: 'Ctrl + Shift + →', action: 'Align right' },
      { keys: 'Ctrl + Shift + ↑', action: 'Align top' },
      { keys: 'Ctrl + Shift + ↓', action: 'Align bottom' },
    ],
  },
  {
    group: 'Z-Order',
    items: [
      { keys: 'Ctrl + F', action: 'Bring to front' },
      { keys: 'Ctrl + B', action: 'Send to back' },
    ],
  },
  {
    group: 'Pages',
    items: [
      { keys: 'Ctrl + PageDown', action: 'Next page' },
      { keys: 'Ctrl + PageUp', action: 'Previous page' },
    ],
  },
];

export function initShortcutsModal() {
  const btnShortcuts = document.getElementById('btn-shortcuts');
  const overlay = document.getElementById('shortcuts-overlay');
  const closeBtn = document.getElementById('shortcuts-close');
  const okBtn = document.getElementById('shortcuts-ok');
  const body = document.getElementById('shortcuts-body');

  if (!btnShortcuts || !overlay) return;

  // Build content once
  for (const { group, items } of SHORTCUTS) {
    const groupEl = document.createElement('div');
    groupEl.className = 'shortcuts-group';
    const title = document.createElement('h4');
    title.textContent = group;
    groupEl.appendChild(title);
    const table = document.createElement('table');
    table.className = 'shortcuts-table';
    for (const { keys, action } of items) {
      const tr = document.createElement('tr');
      const tdKeys = document.createElement('td');
      tdKeys.className = 'shortcut-keys';
      tdKeys.textContent = keys;
      const tdAction = document.createElement('td');
      tdAction.textContent = action;
      tr.appendChild(tdKeys);
      tr.appendChild(tdAction);
      table.appendChild(tr);
    }
    groupEl.appendChild(table);
    body.appendChild(groupEl);
  }

  const close = () => { overlay.hidden = true; };
  btnShortcuts.addEventListener('click', () => { overlay.hidden = false; });
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (okBtn) okBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (!overlay.hidden && e.key === 'Escape') close(); });
}
