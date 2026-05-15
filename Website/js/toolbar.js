import * as align from './alignment.js';
import { showToast } from './notifications.js';
import { importFromQplug } from './lua-importer.js';

export class Toolbar {
  constructor(dataModel, selectionManager, canvasManager, eventBus, settings) {
    this.dataModel = dataModel;
    this.selection = selectionManager;
    this.canvas = canvasManager;
    this.eventBus = eventBus;
    this.settings = settings;

    this._bindAlignmentButtons();
    this._bindZOrderButtons();
    this._bindFileButtons();
    this._bindLuaPanel();
    this._bindPageEvents();
    this._bindSelectionState();
    this._bindGridArrange();
  }

  _getSelectedRects() {
    return this.selection.getSelectedIds().map(id => {
      const obj = this.dataModel.getObject(id);
      return { id: obj.id, x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    });
  }

  _getAnchorRect(rects) {
    const anchor = this.settings.get('alignmentAnchor');
    return anchor === 'last' ? rects[rects.length - 1] : rects[0];
  }

  _apply(fn, minCount = 2, useAnchor = false) {
    const rects = this._getSelectedRects();
    if (rects.length < minCount) return;
    const updates = useAnchor ? fn(rects, this._getAnchorRect(rects)) : fn(rects);
    if (updates.length > 0) {
      this.dataModel.updateMultiple(updates);
    }
  }

  _applyWithCanvas(fn, minCount = 1) {
    const rects = this._getSelectedRects();
    if (rects.length < minCount) return;
    const updates = fn(rects, this.dataModel.canvasWidth, this.dataModel.canvasHeight);
    if (updates.length > 0) {
      this.dataModel.updateMultiple(updates);
    }
  }

  _bindAlignmentButtons() {
    const bind = (id, fn, min, useAnchor = false) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => this._apply(fn, min, useAnchor));
    };
    const bindCanvas = (id, fn, min) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => this._applyWithCanvas(fn, min));
    };

    // Alignment (2+ selected, anchored)
    bind('btn-align-left', align.alignLeft, 2, true);
    bind('btn-align-center-h', align.alignCenterHorizontal, 2, true);
    bind('btn-align-right', align.alignRight, 2, true);
    bind('btn-align-top', align.alignTop, 2, true);
    bind('btn-align-center-v', align.alignCenterVertical, 2, true);
    bind('btn-align-bottom', align.alignBottom, 2, true);

    // Distribution — gap-aware (2+ selected when gap is set, 3+ for equal spacing)
    const getGap = () => {
      const inp = document.getElementById('dist-gap');
      if (!inp || inp.value.trim() === '') return null;
      const v = parseInt(inp.value);
      return isNaN(v) ? null : Math.max(0, v);
    };
    const distHEl = document.getElementById('btn-dist-h');
    if (distHEl) distHEl.addEventListener('click', () => {
      const rects = this._getSelectedRects();
      if (rects.length < 2) return;
      const gap = getGap();
      const updates = gap !== null
        ? align.distributeHorizontallyWithGap(rects, gap)
        : align.distributeHorizontally(rects);
      if (updates.length > 0) this.dataModel.updateMultiple(updates);
    });
    const distVEl = document.getElementById('btn-dist-v');
    if (distVEl) distVEl.addEventListener('click', () => {
      const rects = this._getSelectedRects();
      if (rects.length < 2) return;
      const gap = getGap();
      const updates = gap !== null
        ? align.distributeVerticallyWithGap(rects, gap)
        : align.distributeVertically(rects);
      if (updates.length > 0) this.dataModel.updateMultiple(updates);
    });

    // Sizing (2+ selected, anchored)
    bind('btn-same-width', align.makeSameWidth, 2, true);
    bind('btn-same-height', align.makeSameHeight, 2, true);
    bind('btn-same-size', align.makeSameSize, 2, true);

    // Packing (2+ selected, no anchor)
    bind('btn-pack-left', align.packLeft, 2);
    bind('btn-pack-right', align.packRight, 2);
    bind('btn-pack-top', align.packTop, 2);
    bind('btn-pack-bottom', align.packBottom, 2);

    // Center on page (1+ selected, needs canvas dims)
    bindCanvas('btn-center-page-h', (rects, cw) => align.centerOnPageHorizontal(rects, cw), 1);
    bindCanvas('btn-center-page-v', (rects, _cw, ch) => align.centerOnPageVertical(rects, ch), 1);

    // Space evenly (2+ selected, needs canvas dims)
    bindCanvas('btn-space-even-h', (rects, cw) => align.spaceEvenlyHorizontal(rects, cw), 2);
    bindCanvas('btn-space-even-v', (rects, _cw, ch) => align.spaceEvenlyVertical(rects, ch), 2);
  }

  _bindZOrderButtons() {
    const btnFront = document.getElementById('btn-bring-front');
    const btnBack = document.getElementById('btn-send-back');

    if (btnFront) {
      btnFront.addEventListener('click', () => {
        const ids = this.selection.getSelectedIds();
        if (ids.length > 0) this.dataModel.bringToFront(ids);
      });
    }
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        const ids = this.selection.getSelectedIds();
        if (ids.length > 0) this.dataModel.sendToBack(ids);
      });
    }
  }

  _bindFileButtons() {
    const btnNew = document.getElementById('btn-new');
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    const fileInput = document.getElementById('file-input');
    const btnImport = document.getElementById('btn-import-qplug');
    const qplugInput = document.getElementById('file-input-qplug');

    if (btnNew) {
      btnNew.addEventListener('click', () => {
        if (this.dataModel.objects.length === 0 || confirm('Start a new project? Unsaved changes will be lost.')) {
          this.selection.clearSelection();
          this.dataModel.clear();
        }
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const json = JSON.stringify(this.dataModel.toJSON(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qsys-layout.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (btnLoad && fileInput) {
      btnLoad.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(reader.result);
            this.selection.clearSelection();
            this.dataModel.fromJSON(json);
            showToast('Project loaded.', 'success');
          } catch (e) {
            showToast('Failed to load project: ' + e.message, 'error', 6000);
          }
        };
        reader.readAsText(file);
        fileInput.value = '';
      });
    }

    if (btnImport && qplugInput) {
      btnImport.addEventListener('click', () => qplugInput.click());
      qplugInput.addEventListener('change', () => {
        const file = qplugInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = importFromQplug(reader.result);
            if (!result) {
              showToast('Could not find GetControlLayout in this file.', 'error', 6000);
              return;
            }
            this.selection.clearSelection();
            this.dataModel.fromJSON(result);
            const warns = result._warnings || [];
            if (warns.length > 0) {
              showToast(`Imported with ${warns.length} warning(s). Check console for details.`, 'warning', 8000);
              for (const w of warns) console.warn('[qplug import]', w);
            } else {
              const ctrlCount = (result.objects || []).filter(o => o.kind === 'control').length;
              const pageCount = (result.pages || []).length;
              showToast(`Imported ${ctrlCount} control(s) across ${pageCount} page(s).`, 'success');
            }
          } catch (e) {
            showToast('Import failed: ' + e.message, 'error', 6000);
            console.error('[qplug import]', e);
          }
        };
        reader.readAsText(file);
        qplugInput.value = '';
      });
    }
  }

  _bindPageEvents() {
    const sync = () => {
      const wInput = document.getElementById('canvas-width');
      const hInput = document.getElementById('canvas-height');
      if (wInput) wInput.value = this.dataModel.canvasWidth;
      if (hInput) hInput.value = this.dataModel.canvasHeight;
    };
    this.eventBus.on('page:switched', sync);
    this.eventBus.on('model:loaded', sync);
  }

  _bindSelectionState() {
    // [buttonId, minSelected]
    const rules = [
      // Alignment (2+)
      ['btn-align-left', 2], ['btn-align-center-h', 2], ['btn-align-right', 2],
      ['btn-align-top', 2], ['btn-align-center-v', 2], ['btn-align-bottom', 2],
      // Distribution (2+ — gap mode works with 2; auto-spacing is a no-op with 2 but that's acceptable)
      ['btn-dist-h', 2], ['btn-dist-v', 2],
      // Sizing (2+)
      ['btn-same-width', 2], ['btn-same-height', 2], ['btn-same-size', 2],
      // Packing (2+)
      ['btn-pack-left', 2], ['btn-pack-right', 2], ['btn-pack-top', 2], ['btn-pack-bottom', 2],
      // Space evenly (2+)
      ['btn-space-even-h', 2], ['btn-space-even-v', 2],
      // Center on page (1+)
      ['btn-center-page-h', 1], ['btn-center-page-v', 1],
      // Z-order (1+)
      ['btn-bring-front', 1], ['btn-send-back', 1],
      // Grid arrange (2+)
      ['btn-grid-arrange', 2],
    ];

    const entries = rules.map(([id, min]) => [document.getElementById(id), min]).filter(([el]) => el);

    const update = (ids) => {
      const count = ids.length;
      for (const [el, min] of entries) {
        el.disabled = count < min;
      }
    };

    this.eventBus.on('selection:changed', update);
    update([]); // initial state — nothing selected
  }

  _bindGridArrange() {
    const btn     = document.getElementById('btn-grid-arrange');
    const popover = document.getElementById('grid-popover');
    if (!btn || !popover) return;

    const colsInput = document.getElementById('grid-cols');
    const gapXInput = document.getElementById('grid-gap-x');
    const gapYInput = document.getElementById('grid-gap-y');
    const applyBtn  = document.getElementById('grid-apply');
    const cancelBtn = document.getElementById('grid-cancel');

    let justOpened = false;

    const openPopover = () => {
      const r = btn.getBoundingClientRect();
      const pw = 190;
      let left = r.left;
      if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
      popover.style.top  = (r.bottom + 4) + 'px';
      popover.style.left = Math.max(4, left) + 'px';
      // Clamp columns to current selection count
      const count = this.selection.getSelectedIds().length;
      if (colsInput) {
        colsInput.max = count;
        if (parseInt(colsInput.value) > count) colsInput.value = Math.max(1, Math.ceil(Math.sqrt(count)));
      }
      popover.hidden = false;
      justOpened = true;
    };

    btn.addEventListener('click', () => {
      if (popover.hidden) openPopover();
      else popover.hidden = true;
    });

    const doApply = () => {
      const rects = this._getSelectedRects();
      if (rects.length < 2) { popover.hidden = true; return; }
      const cols = Math.max(1, Math.min(rects.length, parseInt(colsInput?.value) || 2));
      const gapX = Math.max(0, parseInt(gapXInput?.value) || 0);
      const gapY = Math.max(0, parseInt(gapYInput?.value) || 0);
      const updates = align.arrangeInGrid(rects, cols, gapX, gapY);
      if (updates.length > 0) this.dataModel.updateMultiple(updates);
      popover.hidden = true;
    };

    if (applyBtn)  applyBtn.addEventListener('click', doApply);
    if (cancelBtn) cancelBtn.addEventListener('click', () => { popover.hidden = true; });

    for (const inp of [colsInput, gapXInput, gapYInput]) {
      if (inp) inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') doApply();
      });
    }

    document.addEventListener('click', e => {
      if (justOpened) { justOpened = false; return; }
      if (!popover.hidden && !popover.contains(e.target) && e.target !== btn) {
        popover.hidden = true;
      }
    });
  }

  _bindLuaPanel() {
    const btnToggle = document.getElementById('btn-toggle-lua');
    const btnMaximize = document.getElementById('btn-maximize-lua');
    const luaPanel = document.getElementById('lua-panel');
    if (btnToggle && luaPanel) {
      btnToggle.addEventListener('click', () => {
        luaPanel.classList.toggle('collapsed');
        if (luaPanel.classList.contains('collapsed')) {
          luaPanel.classList.remove('maximized');
          btnMaximize.textContent = '\u2922';
        }
        btnToggle.textContent = luaPanel.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
      });
    }

    if (btnMaximize && luaPanel) {
      btnMaximize.addEventListener('click', () => {
        luaPanel.classList.remove('collapsed');
        luaPanel.classList.toggle('maximized');
        btnToggle.textContent = '\u25BC';
        btnMaximize.textContent = luaPanel.classList.contains('maximized') ? '\u2923' : '\u2922';
      });
    }

  }
}
