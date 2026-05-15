export function initSettingsModal({ settings, canvas, dataModel }) {
  const overlay  = document.getElementById('settings-overlay');
  const btnOpen  = document.getElementById('btn-settings');
  const btnSave  = document.getElementById('settings-save');
  const btnCancel = document.getElementById('settings-cancel');
  const btnClose = document.getElementById('settings-close');

  const fields = {
    defaultUserPin:     document.getElementById('setting-default-user-pin'),
    defaultPinStyle:    document.getElementById('setting-default-pin-style'),
    autoAddLabel:       document.getElementById('setting-auto-add-label'),
    alignmentAnchor:    document.getElementById('setting-alignment-anchor'),
    gridSize:           document.getElementById('setting-grid-size'),
    snapToGrid:         document.getElementById('setting-snap'),
    showGrid:           document.getElementById('setting-show-grid'),
    canvasWidth:        document.getElementById('setting-canvas-width'),
    canvasHeight:       document.getElementById('setting-canvas-height'),
    autoGenerateStatus: document.getElementById('setting-auto-generate-status'),
    authorName:         document.getElementById('setting-author-name'),
  };

  function populate() {
    const v = settings.getAll();
    fields.defaultUserPin.checked     = v.defaultUserPin;
    fields.defaultPinStyle.value      = v.defaultPinStyle;
    fields.autoAddLabel.checked       = v.autoAddLabel;
    fields.alignmentAnchor.value      = v.alignmentAnchor;
    fields.autoGenerateStatus.checked = v.autoGenerateStatus;
    fields.authorName.value           = v.authorName || '';
    fields.gridSize.value             = v.gridSize;
    fields.snapToGrid.checked         = v.snapToGrid;
    fields.showGrid.checked           = v.showGrid;
    fields.canvasWidth.value          = v.canvasWidth;
    fields.canvasHeight.value         = v.canvasHeight;
  }

  function close() { overlay.hidden = true; }

  btnOpen.addEventListener('click', () => { populate(); overlay.hidden = false; });
  btnCancel.addEventListener('click', close);
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  btnSave.addEventListener('click', () => {
    settings.setAll({
      defaultUserPin:     fields.defaultUserPin.checked,
      defaultPinStyle:    fields.defaultPinStyle.value,
      autoAddLabel:       fields.autoAddLabel.checked,
      alignmentAnchor:    fields.alignmentAnchor.value,
      autoGenerateStatus: fields.autoGenerateStatus.checked,
      authorName:         fields.authorName.value.trim(),
      gridSize:           parseInt(fields.gridSize.value) || 10,
      snapToGrid:         fields.snapToGrid.checked,
      showGrid:           fields.showGrid.checked,
      canvasWidth:        parseInt(fields.canvasWidth.value) || 400,
      canvasHeight:       parseInt(fields.canvasHeight.value) || 300,
    });
    canvas.setGridSize(settings.get('gridSize'));
    canvas.setShowGrid(settings.get('showGrid'));
    canvas.setSnapEnabled(settings.get('snapToGrid'));
    dataModel.setCanvasSize(settings.get('canvasWidth'), settings.get('canvasHeight'));
    close();
  });
}
