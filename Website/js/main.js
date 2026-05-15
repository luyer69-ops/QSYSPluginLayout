import { EventBus } from './event-bus.js';
import { Settings } from './settings.js';
import { DataModel } from './data-model.js';
import { SelectionManager } from './selection.js';
import { CanvasManager } from './canvas.js';
import { Toolbox } from './toolbox.js';
import { PropertiesPanel } from './properties-panel.js';
import { Toolbar } from './toolbar.js';
import { PageTabs } from './page-tabs.js';
import { Outline } from './outline.js';
import { generateLua, findControlLineRanges, findRuntimeLineRanges, isPluginInfoComplete } from './lua-codegen.js';
import * as align from './alignment.js';
import { highlightLua } from './lua-highlight.js';
import { UndoManager } from './undo-manager.js';
import { deepClone } from './utils.js';
import { initSettingsModal } from './modal-settings.js';
import { initPluginInfoModal } from './modal-plugin-info.js';
import { initPinsModal } from './modal-pins.js';
import { initDesignPropsModal } from './modal-design-props.js';
import { initShortcutsModal } from './modal-shortcuts.js';
import { showToast } from './notifications.js';

// ── Initialize ──
const eventBus = new EventBus();
const settings = new Settings(eventBus);
const dataModel = new DataModel(eventBus, settings);
const undoManager = new UndoManager(dataModel);
dataModel.undoManager = undoManager;
const selection = new SelectionManager(eventBus);
const canvas = new CanvasManager(dataModel, selection, eventBus);
const toolbox = new Toolbox(dataModel, canvas, eventBus, settings);
const propertiesPanel = new PropertiesPanel(dataModel, selection, eventBus);
const toolbar = new Toolbar(dataModel, selection, canvas, eventBus, settings);
const pageTabs = new PageTabs(dataModel, selection, eventBus);
const outline = new Outline(dataModel, selection, eventBus);

// ── Disclaimer modal ──
{
  const DISCLAIMER_KEY = 'disclaimerAcknowledged';
  if (!localStorage.getItem(DISCLAIMER_KEY)) {
    const overlay = document.getElementById('disclaimer-overlay');
    const btnOk = document.getElementById('disclaimer-ok');
    const chkDontShow = document.getElementById('disclaimer-dont-show');
    overlay.hidden = false;
    btnOk.addEventListener('click', () => {
      if (chkDontShow.checked) localStorage.setItem(DISCLAIMER_KEY, '1');
      overlay.hidden = true;
    });
  }
}

// ── Canvas theme ──
function applyCanvasTheme() {
  const isLight = (settings.get('canvasTheme') || 'dark') === 'light';
  document.getElementById('canvas').classList.toggle('theme-light', isLight);
  document.getElementById('canvas-container').classList.toggle('theme-light', isLight);
}

document.getElementById('btn-theme-toggle').addEventListener('click', () => {
  const current = settings.get('canvasTheme') || 'dark';
  settings.set('canvasTheme', current === 'dark' ? 'light' : 'dark');
  applyCanvasTheme();
});

// ── Apply saved settings on startup ──
canvas.setGridSize(settings.get('gridSize'));
canvas.setShowGrid(settings.get('showGrid'));
canvas.setSnapEnabled(settings.get('snapToGrid'));
dataModel.setCanvasSize(settings.get('canvasWidth'), settings.get('canvasHeight'));
applyCanvasTheme();

// ── Undo batching for drag/keyboard operations ──
eventBus.on('drag:start', () => undoManager.beginBatch());
eventBus.on('drag:end', () => undoManager.endBatch());

let _keyMoveBatchTimer = null;
function beginKeyMoveBatch() {
  if (!_keyMoveBatchTimer) undoManager.beginBatch();
  else clearTimeout(_keyMoveBatchTimer);
  _keyMoveBatchTimer = setTimeout(() => {
    undoManager.endBatch();
    _keyMoveBatchTimer = null;
  }, 500);
}

// ── Modals (improvement #8 — extracted into own modules) ──
const onModelSaved = () => { refreshLua(); autosave(); };

initSettingsModal({ settings, canvas, dataModel });
initPluginInfoModal({ dataModel, settings, onSaved: onModelSaved });
initPinsModal({ dataModel, onSaved: onModelSaved });
initDesignPropsModal({ dataModel, onSaved: onModelSaved });
initShortcutsModal();

// ── Help — opens in new tab (improvement #12) ──
document.getElementById('btn-help').addEventListener('click', () => {
  window.open('help/help.html', '_blank', 'noopener');
});

// ── About modal ──
{
  const overlay = document.getElementById('about-overlay');
  const close = () => { overlay.hidden = true; };
  document.getElementById('btn-about').addEventListener('click', () => { overlay.hidden = false; });
  document.getElementById('about-ok').addEventListener('click', close);
  document.getElementById('about-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

// ── Select newly created objects ──
eventBus.on('toolbox:object-created', obj => { selection.select(obj.id); });

// ── Clean up selection when objects removed ──
eventBus.on('object:removed', obj => { selection.handleObjectRemoved(obj.id); });

// ── Lua generation ──
const btnGenerate = document.getElementById('btn-generate-lua');
const luaOutput = document.getElementById('lua-output');
const btnPluginInfo = document.getElementById('btn-plugin-info');
const luaPanelHeader = document.getElementById('lua-panel-header');
let _currentLuaCode = '';

function refreshLua() {
  _currentLuaCode = generateLua(dataModel, settings);
  luaOutput.innerHTML = highlightLua(_currentLuaCode);
  highlightSelectedControl();
  updatePluginInfoWarning();
}

function updatePluginInfoWarning() {
  const complete = isPluginInfoComplete(dataModel);
  if (btnPluginInfo) btnPluginInfo.classList.toggle('warning', !complete);
  let badge = luaPanelHeader.querySelector('.lua-warning');
  if (!complete) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'lua-warning';
      badge.title = 'PluginInfo is incomplete — Name, Version, and Id are required';
      badge.textContent = '⚠';
      luaPanelHeader.querySelector('h3').after(badge);
    }
  } else if (badge) {
    badge.remove();
  }
}

function highlightSelectedControl() {
  luaOutput.querySelectorAll('.lua-line.hl').forEach(el => el.classList.remove('hl'));
  const ids = selection.getSelectedIds();
  if (ids.length !== 1) return;
  const obj = dataModel.getObject(ids[0]);
  if (!obj) return;

  let allRanges = [];
  if (obj.kind === 'control') {
    const name = obj.controlDef.Name;
    if (!name) return;
    allRanges = findControlLineRanges(_currentLuaCode, name);
    allRanges.push(...findRuntimeLineRanges(_currentLuaCode, name));
  } else {
    const gp = obj.graphicProps;
    const label = gp.Text ? `${gp.Type}: ${gp.Text}` : gp.Type;
    allRanges = findControlLineRanges(_currentLuaCode, label);
  }

  let first = null;
  for (const [start, end] of allRanges) {
    for (let i = start; i <= end; i++) {
      const el = luaOutput.querySelector(`[data-line="${i}"]`);
      if (el) {
        el.classList.add('hl');
        if (!first) first = el;
      }
    }
  }
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

eventBus.on('selection:changed', highlightSelectedControl);

eventBus.on('canvas:dblclick', obj => {
  propertiesPanel.focusProperty(obj.kind === 'control' ? 'Name' : 'Text');
});

if (btnGenerate) btnGenerate.addEventListener('click', refreshLua);

// ── Download ──
const btnDownload = document.getElementById('btn-download');
if (btnDownload) {
  btnDownload.addEventListener('click', () => {
    const pi = dataModel.getPluginInfo() || {};
    const name = (pi.Name || 'plugin').replace(/[^a-zA-Z0-9_\- ]/g, '');
    const version = (pi.Version || '').replace(/[^a-zA-Z0-9._\-]/g, '');
    const filename = version ? `${name} v${version}.qplug` : `${name}.qplug`;
    const blob = new Blob([_currentLuaCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ── Lua copy button with visual feedback (improvement #11) ──
{
  const btnCopy = document.getElementById('btn-copy-lua');
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(_currentLuaCode);
        const original = btnCopy.textContent;
        btnCopy.textContent = 'Copied!';
        setTimeout(() => { btnCopy.textContent = original; }, 1500);
      } catch {
        // Fallback for environments without clipboard API
        const ta = document.createElement('textarea');
        ta.value = _currentLuaCode;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
    });
  }
}

// ── Lua panel manual copy: plain text only ──
document.getElementById('lua-output-wrap').addEventListener('copy', e => {
  const sel = window.getSelection();
  if (sel) {
    e.preventDefault();
    e.clipboardData.setData('text/plain', sel.toString());
  }
});

// ── Model event → Lua refresh (improvement #17 — only regenerate when relevant) ──
eventBus.on('object:added', refreshLua);
eventBus.on('object:removed', refreshLua);
eventBus.on('object:updated', refreshLua);
eventBus.on('objects:bulk-updated', refreshLua);
eventBus.on('model:loaded', refreshLua);
eventBus.on('page:added', refreshLua);
eventBus.on('page:removed', refreshLua);
eventBus.on('page:renamed', refreshLua);
eventBus.on('page:switched', refreshLua);
eventBus.on('pluginInfo:changed', refreshLua);
eventBus.on('pins:changed', refreshLua);
eventBus.on('designProperties:changed', refreshLua);

// Only regenerate Lua when settings that affect output actually change
eventBus.on('settings:changed', ({ key }) => {
  if (key === null || key === 'autoGenerateStatus' || key === 'authorName') {
    refreshLua();
  }
});

// Clear selection on page switch
eventBus.on('page:switched', () => selection.clearSelection());

// ── Auto-save to localStorage ──
const AUTOSAVE_KEY = 'qsys-layout-autosave';
let _autosaveTimer = null;
const _saveIndicator = document.getElementById('save-indicator');
let _saveIndicatorClearTimer = null;

function _setSaveIndicator(state) {
  if (!_saveIndicator) return;
  clearTimeout(_saveIndicatorClearTimer);
  _saveIndicator.className = 'save-indicator save-indicator-' + state;
  if (state === 'saving') {
    _saveIndicator.textContent = 'Saving…';
  } else if (state === 'saved') {
    _saveIndicator.textContent = 'Saved ✓';
    _saveIndicatorClearTimer = setTimeout(() => {
      _saveIndicator.className = 'save-indicator save-indicator-idle';
      _saveIndicator.textContent = '';
    }, 3000);
  } else if (state === 'error') {
    _saveIndicator.textContent = 'Save error';
  }
}

function autosave() {
  clearTimeout(_autosaveTimer);
  _setSaveIndicator('saving');
  _autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataModel.toJSON()));
      _setSaveIndicator('saved');
    } catch (_e) {
      _setSaveIndicator('error');
    }
  }, 500);
}

eventBus.on('object:added', autosave);
eventBus.on('object:removed', autosave);
eventBus.on('object:updated', autosave);
eventBus.on('objects:bulk-updated', autosave);
eventBus.on('model:loaded', autosave);
eventBus.on('page:added', autosave);
eventBus.on('page:removed', autosave);
eventBus.on('page:renamed', autosave);
eventBus.on('canvas:resized', autosave);
eventBus.on('pluginInfo:changed', autosave);
eventBus.on('pins:changed', autosave);
eventBus.on('designProperties:changed', autosave);

window.addEventListener('beforeunload', () => {
  clearTimeout(_autosaveTimer);
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataModel.toJSON()));
  } catch (_e) { /* ignore */ }
});

// ── Restore on startup (improvement #3 — also restores projects with only metadata) ──
let restoredFromSave = false;
try {
  const saved = localStorage.getItem(AUTOSAVE_KEY);
  if (saved) {
    const json = JSON.parse(saved);
    if (json && (json.objects?.length > 0 || json.pluginInfo || json.pins?.length > 0 || json.designProperties?.length > 0 || json.pages?.length > 1)) {
      dataModel.fromJSON(json);
      restoredFromSave = true;
    }
  }
} catch (_e) {
  // Corrupted data — start fresh
}

if (!restoredFromSave) {
  dataModel._seedStatusControl();
  dataModel.eventBus.emit('model:loaded', dataModel.toJSON());
}

refreshLua();

// ── Clipboard for copy/paste (improvement #13 — Ctrl+C / Ctrl+V) ──
let _clipboard = [];

// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  // Undo / Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undoManager.undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
    e.preventDefault();
    undoManager.redo();
    return;
  }

  const ids = selection.getSelectedIds();

  // Delete
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (ids.length > 0) dataModel.removeObjects(ids);
    return;
  }

  // Select All
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    selection.selectMultiple(dataModel.getAllObjects().map(o => o.id));
    return;
  }

  // Copy (Ctrl+C)
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    if (ids.length > 0) {
      _clipboard = ids.map(id => dataModel.getObject(id)).filter(Boolean).map(o => deepClone(o));
    }
    return;
  }

  // Paste (Ctrl+V)
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    if (_clipboard.length > 0) {
      const pasted = dataModel.pasteObjects(_clipboard);
      selection.selectMultiple(pasted.map(o => o.id));
    }
    return;
  }

  // Duplicate (Ctrl+D)
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    if (ids.length > 0) {
      const dupes = dataModel.duplicateObjects(ids);
      selection.selectMultiple(dupes.map(d => d.id));
    }
    return;
  }

  // Escape — deselect
  if (e.key === 'Escape') {
    selection.clearSelection();
    return;
  }

  // Page navigation: Ctrl+PageDown / Ctrl+PageUp
  if ((e.ctrlKey || e.metaKey) && e.key === 'PageDown') {
    e.preventDefault();
    const pages = dataModel.getPages();
    const idx = dataModel.getCurrentPageIndex();
    if (idx < pages.length - 1) { selection.clearSelection(); dataModel.switchPage(pages[idx + 1].id); }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'PageUp') {
    e.preventDefault();
    const pages = dataModel.getPages();
    const idx = dataModel.getCurrentPageIndex();
    if (idx > 0) { selection.clearSelection(); dataModel.switchPage(pages[idx - 1].id); }
    return;
  }

  // Ctrl+Shift+Arrow — alignment
  const alignMap = {
    ArrowLeft: align.alignLeft,
    ArrowRight: align.alignRight,
    ArrowUp: align.alignTop,
    ArrowDown: align.alignBottom,
  };
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && alignMap[e.key] && ids.length >= 2) {
    e.preventDefault();
    const rects = ids.map(id => {
      const obj = dataModel.getObject(id);
      return { id: obj.id, x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    });
    const anchor = settings.get('alignmentAnchor') === 'last' ? rects[rects.length - 1] : rects[0];
    const updates = alignMap[e.key](rects, anchor);
    if (updates.length > 0) dataModel.updateMultiple(updates);
    return;
  }

  // Bring to Front / Send to Back
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    if (ids.length > 0) dataModel.bringToFront(ids);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    if (ids.length > 0) dataModel.sendToBack(ids);
    return;
  }

  // Arrow keys — move or resize
  const arrowMap = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrowMap[e.key] && ids.length > 0) {
    e.preventDefault();
    beginKeyMoveBatch();
    const [dx, dy] = arrowMap[e.key];
    const fine = e.ctrlKey || e.metaKey;
    const step = fine ? 1 : (canvas.snapEnabled ? canvas.gridSize : 1);

    if (e.shiftKey) {
      const updates = ids.map(id => {
        const obj = dataModel.getObject(id);
        return { id, changes: { w: Math.max(8, obj.w + dx * step), h: Math.max(8, obj.h + dy * step) } };
      });
      dataModel.updateMultiple(updates);
    } else {
      const updates = ids.map(id => {
        const obj = dataModel.getObject(id);
        return { id, changes: { x: Math.max(0, obj.x + dx * step), y: Math.max(0, obj.y + dy * step) } };
      });
      dataModel.updateMultiple(updates);
    }
    return;
  }
});
