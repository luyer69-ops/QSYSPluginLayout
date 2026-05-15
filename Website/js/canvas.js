import { createObjectElement, updateObjectElement } from './canvas-object.js';

export class CanvasManager {
  constructor(dataModel, selectionManager, eventBus) {
    this.dataModel = dataModel;
    this.selection = selectionManager;
    this.eventBus = eventBus;

    this.canvasEl = document.getElementById('canvas');
    this.viewport = document.getElementById('canvas-viewport');
    this.selectionRectEl = document.getElementById('selection-rect');
    this.targetSizeEl = document.getElementById('target-size-rect');
    this.bboxEl = document.getElementById('bounding-box-rect');
    this.bboxLabel = this.bboxEl.querySelector('.bbox-label');
    this._elements = new Map(); // id -> DOM element

    this.gridSize = 10;
    this.showGrid = true;
    this.snapEnabled = true;
    this._guideEls = []; // pool of smart-guide DOM elements

    this._setupGrid();
    this._updateCanvasLayout();
    this._bindEvents();
    this._bindModelEvents();
  }

  _setupGrid() {
    if (this.showGrid) {
      this.canvasEl.classList.add('show-grid');
    }
    this._updateGridSize();
  }

  _updateGridSize() {
    this.canvasEl.style.backgroundSize = `${this.gridSize}px ${this.gridSize}px`;
  }

  _maybeUpdateLayout() {
    if (!this._dragState) this._updateCanvasLayout();
  }

  _updateCanvasLayout() {
    const bbox = this.dataModel.getVisibleBoundingBox();
    const tw = this.dataModel.canvasWidth;
    const th = this.dataModel.canvasHeight;

    // Viewport inner size (subtract padding)
    const vpW = this.viewport.clientWidth - 80;
    const vpH = this.viewport.clientHeight - 80;

    // Canvas = max of target, bounding box, viewport + extra working space
    const PADDING = 200;
    const canvasW = Math.max(tw, bbox.w, vpW) + PADDING;
    const canvasH = Math.max(th, bbox.h, vpH) + PADDING;
    this.canvasEl.style.width = canvasW + 'px';
    this.canvasEl.style.height = canvasH + 'px';

    // Target size overlay
    this.targetSizeEl.style.width = tw + 'px';
    this.targetSizeEl.style.height = th + 'px';

    // Bounding box overlay
    if (bbox.w > 0 && bbox.h > 0) {
      this.bboxEl.classList.remove('empty');
      this.bboxEl.style.width = bbox.w + 'px';
      this.bboxEl.style.height = bbox.h + 'px';
      this.bboxLabel.textContent = `${bbox.w} \u00d7 ${bbox.h}`;
    } else {
      this.bboxEl.classList.add('empty');
    }
  }

  setGridSize(size) {
    this.gridSize = size;
    this._updateGridSize();
  }

  setShowGrid(show) {
    this.showGrid = show;
    this.canvasEl.classList.toggle('show-grid', show);
  }

  setSnapEnabled(snap) {
    this.snapEnabled = snap;
  }

  // ── Model event handlers ──

  _bindModelEvents() {
    this.eventBus.on('object:added', obj => { this._addElement(obj); this._maybeUpdateLayout(); });
    this.eventBus.on('object:removed', obj => { this._removeElement(obj.id); this._maybeUpdateLayout(); });
    this.eventBus.on('object:updated', obj => { this._updateElement(obj); this._maybeUpdateLayout(); });
    this.eventBus.on('objects:bulk-updated', objects => {
      for (const obj of objects) this._updateElement(obj);
      this._maybeUpdateLayout();
    });
    this.eventBus.on('model:loaded', () => this._rebuildAll());
    this.eventBus.on('canvas:resized', () => this._updateCanvasLayout());
    this.eventBus.on('selection:changed', ids => this._updateSelectionVisuals(ids));
    this.eventBus.on('page:switched', () => this._rebuildAll());
    this.eventBus.on('page:removed', () => this._rebuildAll());
  }

  _addElement(obj) {
    const el = createObjectElement(obj);
    this.canvasEl.appendChild(el);
    this._elements.set(obj.id, el);
    // Refresh sibling highlights in case this is a new array member
    this._updateSelectionVisuals(this.selection.getSelectedIds());
  }

  _removeElement(id) {
    const el = this._elements.get(id);
    if (el) {
      el.remove();
      this._elements.delete(id);
    }
  }

  _updateElement(obj) {
    const el = this._elements.get(obj.id);
    const visible = obj.pageId === null || obj.pageId === this.dataModel.currentPageId;

    if (visible && !el) {
      // Object became visible on this page (e.g. pageId changed to current or null)
      this._addElement(obj);
    } else if (!visible && el) {
      // Object moved to another page — remove from canvas
      this._removeElement(obj.id);
    } else if (visible && el) {
      updateObjectElement(el, obj);
    }
  }

  _rebuildAll() {
    // Differential rebuild: only add/remove/update what changed (improvement #7)
    const currentObjects = this.dataModel.getAllObjects();
    const currentIds = new Set(currentObjects.map(o => o.id));

    // Remove elements no longer visible
    for (const [id, el] of this._elements) {
      if (!currentIds.has(id)) {
        el.remove();
        this._elements.delete(id);
      }
    }

    // Update existing or add new elements
    for (const obj of currentObjects) {
      if (this._elements.has(obj.id)) {
        updateObjectElement(this._elements.get(obj.id), obj);
      } else {
        this._addElement(obj);
      }
    }

    this._updateCanvasLayout();
  }

  _updateSelectionVisuals(selectedIds) {
    const idSet = new Set(selectedIds);

    // Collect arrayGroup IDs of selected objects to highlight siblings
    const selectedGroups = new Set();
    for (const id of selectedIds) {
      const obj = this.dataModel.getObject(id);
      if (obj && obj.arrayGroup) selectedGroups.add(obj.arrayGroup);
    }

    for (const [id, el] of this._elements) {
      el.classList.toggle('selected', idSet.has(id));
      // Highlight unselected siblings of selected array members
      if (!idSet.has(id)) {
        const obj = this.dataModel.getObject(id);
        el.classList.toggle('array-sibling', !!(obj && obj.arrayGroup && selectedGroups.has(obj.arrayGroup)));
      } else {
        el.classList.remove('array-sibling');
      }
    }
  }

  // ── Mouse event handling ──

  _bindEvents() {
    this.canvasEl.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvasEl.addEventListener('dblclick', e => this._onDblClick(e));
    document.addEventListener('mousemove', e => this._onMouseMove(e));
    document.addEventListener('mouseup', e => this._onMouseUp(e));
  }

  _canvasCoords(e) {
    const rect = this.canvasEl.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // ── Interaction state ──
  _dragState = null;

  _onMouseDown(e) {
    if (e.button !== 0) return;
    const pos = this._canvasCoords(e);
    const client = { x: e.clientX, y: e.clientY };

    // Check if clicking a resize handle
    const handleEl = e.target.closest('.resize-handle');
    if (handleEl) {
      e.preventDefault();
      e.stopPropagation();
      const objEl = handleEl.closest('.canvas-object');
      const id = objEl.dataset.id;
      const obj = this.dataModel.getObject(id);
      this._dragState = {
        type: 'resize',
        dir: handleEl.dataset.dir,
        ids: this.selection.getSelectedIds(),
        startClient: client,
        originals: this._snapshotSelected(),
        hasMoved: false,
      };
      return;
    }

    // Check if clicking a canvas object
    const objEl = e.target.closest('.canvas-object');
    if (objEl) {
      e.preventDefault();
      const id = objEl.dataset.id;

      if (e.shiftKey) {
        this.selection.toggleSelection(id);
      } else if (!this.selection.isSelected(id)) {
        this.selection.select(id);
      }
      // In all cases, prepare for potential drag
      this._dragState = {
        type: 'move',
        ids: this.selection.getSelectedIds(),
        startClient: client,
        originals: this._snapshotSelected(),
        hasMoved: false,
      };
      return;
    }

    // Clicking on empty canvas — start rubber band (uses canvas coords)
    if (e.target === this.canvasEl || e.target === this.selectionRectEl) {
      if (!e.shiftKey) {
        this.selection.clearSelection();
      }
      this._dragState = {
        type: 'rubberband',
        startMouse: pos,
        additive: e.shiftKey,
        priorSelection: e.shiftKey ? this.selection.getSelectedIds() : [],
      };
      this.selectionRectEl.hidden = false;
      this._updateRubberBand(pos, pos);
    }
  }

  _onDblClick(e) {
    const objEl = e.target.closest('.canvas-object');
    if (!objEl) return;
    const id = objEl.dataset.id;
    const obj = this.dataModel.getObject(id);
    if (!obj) return;
    this.eventBus.emit('canvas:dblclick', obj);
  }

  _onMouseMove(e) {
    if (!this._dragState) return;
    const ds = this._dragState;

    if (ds.type === 'move') {
      if (!ds.hasMoved) this.eventBus.emit('drag:start');
      ds.hasMoved = true;
      const dx = e.clientX - ds.startClient.x;
      const dy = e.clientY - ds.startClient.y;

      // ── Smart guides: compute guide snaps against non-selected objects ──
      let guideDX = 0, guideDY = 0;
      if (!(e.ctrlKey || e.metaKey) && ds.originals.size > 0) {
        const origRects = [...ds.originals.values()];
        const proposed = {
          left:   Math.min(...origRects.map(r => r.x))       + dx,
          right:  Math.max(...origRects.map(r => r.x + r.w)) + dx,
          top:    Math.min(...origRects.map(r => r.y))       + dy,
          bottom: Math.max(...origRects.map(r => r.y + r.h)) + dy,
        };
        proposed.cx = (proposed.left + proposed.right) / 2;
        proposed.cy = (proposed.top  + proposed.bottom) / 2;
        const gr = this._computeSmartGuides(proposed, new Set(ds.ids));
        guideDX = gr.snapDX;
        guideDY = gr.snapDY;
        this._showGuides(gr.guides);
      } else {
        this._clearGuides();
      }

      const updates = ds.ids.map(id => {
        const orig = ds.originals.get(id);
        let newX = orig.x + dx;
        let newY = orig.y + dy;
        // Guide snap overrides grid snap per axis
        if (guideDX !== 0) { newX += guideDX; }
        else if (this.snapEnabled && !(e.ctrlKey || e.metaKey)) { newX = this._snap(newX); }
        if (guideDY !== 0) { newY += guideDY; }
        else if (this.snapEnabled && !(e.ctrlKey || e.metaKey)) { newY = this._snap(newY); }
        return { id, changes: { x: Math.max(0, newX), y: Math.max(0, newY) } };
      });
      this.dataModel.updateMultiple(updates);
    }

    if (ds.type === 'resize') {
      if (!ds.hasMoved) this.eventBus.emit('drag:start');
      ds.hasMoved = true;
      // Use screen-space delta (immune to canvas resizing during drag)
      const dx = e.clientX - ds.startClient.x;
      const dy = e.clientY - ds.startClient.y;
      const updates = ds.ids.map(id => {
        const orig = ds.originals.get(id);
        return { id, changes: this._computeResize(orig, ds.dir, dx, dy, e.ctrlKey || e.metaKey) };
      });
      this.dataModel.updateMultiple(updates);
    }

    if (ds.type === 'rubberband') {
      // Rubber band uses canvas coords (needs to draw the selection rect on canvas)
      const pos = this._canvasCoords(e);
      this._updateRubberBand(ds.startMouse, pos);
      const rect = this._normalizeRect(ds.startMouse, pos);
      const hits = this.selection.getObjectsInRect(rect, this.dataModel.getAllObjects());
      const hitIds = hits.map(o => o.id);
      if (ds.additive) {
        this.selection.selectMultiple([...new Set([...ds.priorSelection, ...hitIds])]);
      } else {
        this.selection.selectMultiple(hitIds);
      }
    }
  }

  _onMouseUp(e) {
    if (!this._dragState) return;
    const ds = this._dragState;

    if (ds.type === 'rubberband') {
      this.selectionRectEl.hidden = true;
    }

    this._clearGuides();

    if (ds.type === 'move' && !ds.hasMoved) {
      // Was a click without drag — if clicking already-selected object without shift,
      // select only this one (deselect others)
      if (!e.shiftKey && ds.ids.length > 1) {
        const pos = this._canvasCoords(e);
        const objEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.canvas-object');
        if (objEl) {
          this.selection.select(objEl.dataset.id);
        }
      }
    }

    if ((ds.type === 'move' && ds.hasMoved) || (ds.type === 'resize' && ds.hasMoved)) {
      this.eventBus.emit('drag:end');
    }

    this._dragState = null;
    this._updateCanvasLayout();
  }

  // ── Helpers ──

  _snap(value) {
    if (!this.snapEnabled || !this.gridSize) return value;
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  _snapshotSelected() {
    const map = new Map();
    for (const id of this.selection.getSelectedIds()) {
      const obj = this.dataModel.getObject(id);
      if (obj) map.set(id, { x: obj.x, y: obj.y, w: obj.w, h: obj.h });
    }
    return map;
  }

  _computeResize(orig, dir, dx, dy, bypassSnap = false) {
    const MIN = 8;
    let w = orig.w, h = orig.h, x = orig.x, y = orig.y;

    if (dir.includes('e')) w = orig.w + dx;
    if (dir.includes('w')) w = orig.w - dx;
    if (dir.includes('s')) h = orig.h + dy;
    if (dir.includes('n')) h = orig.h - dy;

    w = Math.max(MIN, w);
    h = Math.max(MIN, h);

    if (this.snapEnabled && !bypassSnap) {
      w = this._snap(w) || MIN;
      h = this._snap(h) || MIN;
    }

    // Recalculate position after snapping so the fixed edge stays fixed (improvement #2)
    if (dir.includes('w')) x = orig.x + orig.w - w;
    if (dir.includes('n')) y = orig.y + orig.h - h;

    x = Math.max(0, x);
    y = Math.max(0, y);

    return { x, y, w, h };
  }

  _updateRubberBand(start, end) {
    const rect = this._normalizeRect(start, end);
    this.selectionRectEl.style.left = rect.x + 'px';
    this.selectionRectEl.style.top = rect.y + 'px';
    this.selectionRectEl.style.width = rect.w + 'px';
    this.selectionRectEl.style.height = rect.h + 'px';
  }

  _normalizeRect(p1, p2) {
    return {
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      w: Math.abs(p2.x - p1.x),
      h: Math.abs(p2.y - p1.y),
    };
  }

  // ── Smart Guides ──────────────────────────────────────────────────────────

  _computeSmartGuides(proposed, draggedIdSet) {
    const THRESHOLD = Math.max(6, Math.floor(this.gridSize / 2));
    const candidates = this.dataModel.getAllObjects().filter(o => !draggedIdSet.has(o.id));
    if (candidates.length === 0) return { snapDX: 0, snapDY: 0, guides: [] };

    const dragX = [proposed.left, proposed.cx, proposed.right];
    const dragY = [proposed.top,  proposed.cy, proposed.bottom];

    let bestDX = null, xGuide = null;
    let bestDY = null, yGuide = null;

    for (const obj of candidates) {
      const ox = [obj.x, obj.x + obj.w / 2, obj.x + obj.w];
      const oy = [obj.y, obj.y + obj.h / 2, obj.y + obj.h];

      for (const dp of dragX) {
        for (const cp of ox) {
          const d = cp - dp;
          if (Math.abs(d) <= THRESHOLD && (bestDX === null || Math.abs(d) < Math.abs(bestDX))) {
            bestDX = d; xGuide = cp;
          }
        }
      }
      for (const dp of dragY) {
        for (const cp of oy) {
          const d = cp - dp;
          if (Math.abs(d) <= THRESHOLD && (bestDY === null || Math.abs(d) < Math.abs(bestDY))) {
            bestDY = d; yGuide = cp;
          }
        }
      }
    }

    const guides = [];
    if (xGuide !== null) guides.push({ type: 'v', pos: xGuide });
    if (yGuide !== null) guides.push({ type: 'h', pos: yGuide });
    return { snapDX: bestDX ?? 0, snapDY: bestDY ?? 0, guides };
  }

  _showGuides(guides) {
    while (this._guideEls.length < guides.length) {
      const el = document.createElement('div');
      el.className = 'smart-guide';
      this.canvasEl.appendChild(el);
      this._guideEls.push(el);
    }
    guides.forEach((g, i) => {
      const el = this._guideEls[i];
      el.style.display = '';
      if (g.type === 'v') {
        el.className = 'smart-guide smart-guide-v';
        el.style.left = g.pos + 'px';
        el.style.top  = '';
      } else {
        el.className = 'smart-guide smart-guide-h';
        el.style.top  = g.pos + 'px';
        el.style.left = '';
      }
    });
    for (let i = guides.length; i < this._guideEls.length; i++) {
      this._guideEls[i].style.display = 'none';
    }
  }

  _clearGuides() {
    for (const el of this._guideEls) el.style.display = 'none';
  }

  getElementForObject(id) {
    return this._elements.get(id);
  }
}
