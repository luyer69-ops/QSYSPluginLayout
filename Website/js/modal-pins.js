export function initPinsModal({ dataModel, onSaved }) {
  const overlay  = document.getElementById('pins-overlay');
  const btnOpen  = document.getElementById('btn-pins');
  const btnSave  = document.getElementById('pins-save');
  const btnCancel = document.getElementById('pins-cancel');
  const btnClose = document.getElementById('pins-close');
  const btnClear = document.getElementById('pins-clear');
  const btnAdd   = document.getElementById('pins-add');
  const listEl   = document.getElementById('pins-list');

  let editingPins = [];

  function renderRows() {
    listEl.innerHTML = '';
    if (editingPins.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pins-empty';
      empty.textContent = 'No pins defined.';
      listEl.appendChild(empty);
      return;
    }
    editingPins.forEach((pin, i) => {
      const row = document.createElement('div');
      row.className = 'pin-row';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Pin name';
      nameInput.value = pin.Name;
      nameInput.addEventListener('input', () => { editingPins[i].Name = nameInput.value; });

      const dirSelect = document.createElement('select');
      for (const val of ['input', 'output']) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        if (pin.Direction === val) opt.selected = true;
        dirSelect.appendChild(opt);
      }
      dirSelect.addEventListener('change', () => { editingPins[i].Direction = dirSelect.value; });

      const domainSelect = document.createElement('select');
      for (const val of ['audio', 'serial']) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        if (pin.Domain === val) opt.selected = true;
        domainSelect.appendChild(opt);
      }
      domainSelect.addEventListener('change', () => { editingPins[i].Domain = domainSelect.value; });

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove pin';
      removeBtn.addEventListener('click', () => {
        editingPins.splice(i, 1);
        renderRows();
      });

      row.append(nameInput, dirSelect, domainSelect, removeBtn);
      listEl.appendChild(row);
    });
  }

  function open() {
    editingPins = dataModel.getPins().map(p => ({ ...p }));
    renderRows();
    overlay.hidden = false;
  }

  function close() { overlay.hidden = true; }

  btnOpen.addEventListener('click', open);

  btnAdd.addEventListener('click', () => {
    editingPins.push({ Name: '', Direction: 'input', Domain: 'audio' });
    renderRows();
    const inputs = listEl.querySelectorAll('input[type="text"]');
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
  });

  btnClear.addEventListener('click', () => { editingPins = []; renderRows(); });

  btnSave.addEventListener('click', () => {
    const validPins = editingPins
      .filter(p => p.Name.trim())
      .map(p => ({ Name: p.Name.trim(), Direction: p.Direction, Domain: p.Domain }));
    dataModel.setPins(validPins);
    close();
    onSaved();
  });

  btnCancel.addEventListener('click', close);
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}
