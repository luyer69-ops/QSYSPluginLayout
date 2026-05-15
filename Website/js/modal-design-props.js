export function initDesignPropsModal({ dataModel, onSaved }) {
  const overlay   = document.getElementById('designprops-overlay');
  const btnOpen   = document.getElementById('btn-design-props');
  const btnSave   = document.getElementById('designprops-save');
  const btnCancel = document.getElementById('designprops-cancel');
  const btnClose  = document.getElementById('designprops-close');
  const btnClear  = document.getElementById('designprops-clear');
  const btnAdd    = document.getElementById('designprops-add');
  const listEl    = document.getElementById('designprops-list');

  let editingProps = [];

  function renderCards() {
    listEl.innerHTML = '';
    if (editingProps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pins-empty';
      empty.textContent = 'No properties defined.';
      listEl.appendChild(empty);
      return;
    }
    editingProps.forEach((prop, i) => {
      const card = document.createElement('div');
      card.className = 'dprop-card';

      const header = document.createElement('div');
      header.className = 'dprop-card-header';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Property name';
      nameInput.value = prop.Name;
      nameInput.addEventListener('input', () => { editingProps[i].Name = nameInput.value; });

      const typeSelect = document.createElement('select');
      for (const t of ['string', 'integer', 'double', 'boolean', 'enum']) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (prop.Type === t) opt.selected = true;
        typeSelect.appendChild(opt);
      }
      typeSelect.addEventListener('change', () => {
        editingProps[i].Type = typeSelect.value;
        if (typeSelect.value === 'boolean') editingProps[i].Value = true;
        else if (typeSelect.value === 'integer' || typeSelect.value === 'double') editingProps[i].Value = 0;
        else editingProps[i].Value = '';
        renderCards();
      });

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove property';
      removeBtn.addEventListener('click', () => {
        editingProps.splice(i, 1);
        renderCards();
      });

      header.append(nameInput, typeSelect, removeBtn);
      card.appendChild(header);

      const fields = document.createElement('div');
      fields.className = 'dprop-fields';

      if (prop.Type === 'boolean') {
        const f = document.createElement('div');
        f.className = 'dprop-field';
        const lbl = document.createElement('label');
        lbl.textContent = 'Value:';
        const sel = document.createElement('select');
        for (const [text, val] of [['true', true], ['false', false]]) {
          const opt = document.createElement('option');
          opt.value = text;
          opt.textContent = text;
          if (prop.Value === val) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.addEventListener('change', () => { editingProps[i].Value = sel.value === 'true'; });
        f.append(lbl, sel);
        fields.appendChild(f);
      } else if (prop.Type === 'integer' || prop.Type === 'double') {
        for (const [label, key, step] of [['Value:', 'Value', prop.Type === 'integer' ? '1' : 'any'], ['Min:', 'Min', 'any'], ['Max:', 'Max', 'any']]) {
          const f = document.createElement('div');
          f.className = 'dprop-field';
          const lbl = document.createElement('label');
          lbl.textContent = label;
          const inp = document.createElement('input');
          inp.type = 'number';
          inp.step = step;
          inp.value = prop[key] ?? (key === 'Value' ? 0 : '');
          inp.placeholder = key === 'Value' ? '' : '';
          inp.addEventListener('input', () => { editingProps[i][key] = inp.value; });
          f.append(lbl, inp);
          fields.appendChild(f);
        }
      } else if (prop.Type === 'enum') {
        const fVal = document.createElement('div');
        fVal.className = 'dprop-field';
        const lblVal = document.createElement('label');
        lblVal.textContent = 'Default:';
        const valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.value = prop.Value || '';
        valInput.placeholder = '(optional)';
        valInput.addEventListener('input', () => { editingProps[i].Value = valInput.value; });
        fVal.append(lblVal, valInput);
        fields.appendChild(fVal);

        const choicesDiv = document.createElement('div');
        choicesDiv.className = 'dprop-field';
        choicesDiv.style.width = '100%';
        const lblC = document.createElement('label');
        lblC.textContent = 'Choices:';
        const choicesInput = document.createElement('input');
        choicesInput.type = 'text';
        choicesInput.className = 'dprop-choices-input';
        choicesInput.placeholder = 'Choice1, Choice2, Choice3';
        choicesInput.value = (prop.Choices || []).join(', ');
        choicesInput.addEventListener('input', () => {
          editingProps[i].Choices = choicesInput.value.split(',').map(s => s.trim()).filter(Boolean);
        });
        choicesDiv.append(lblC, choicesInput);
        fields.appendChild(choicesDiv);
      } else {
        const f = document.createElement('div');
        f.className = 'dprop-field';
        const lbl = document.createElement('label');
        lbl.textContent = 'Value:';
        const valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.value = prop.Value || '';
        valInput.addEventListener('input', () => { editingProps[i].Value = valInput.value; });
        f.append(lbl, valInput);
        fields.appendChild(f);
      }

      card.appendChild(fields);

      const opt = document.createElement('div');
      opt.className = 'dprop-optional';
      for (const key of ['Header', 'Comment', 'Description']) {
        const f = document.createElement('div');
        f.className = 'dprop-field';
        const lbl = document.createElement('label');
        lbl.textContent = key + ':';
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = prop[key] || '';
        inp.placeholder = key;
        inp.addEventListener('input', () => { editingProps[i][key] = inp.value; });
        f.append(lbl, inp);
        opt.appendChild(f);
      }
      card.appendChild(opt);
      listEl.appendChild(card);
    });
  }

  function open() {
    editingProps = dataModel.getDesignProperties().map(p => ({ ...p, Choices: p.Choices ? [...p.Choices] : [] }));
    renderCards();
    overlay.hidden = false;
  }

  function close() { overlay.hidden = true; }

  btnOpen.addEventListener('click', open);

  btnAdd.addEventListener('click', () => {
    editingProps.push({ Name: '', Type: 'string', Value: '', Choices: [] });
    renderCards();
    const cards = listEl.querySelectorAll('.dprop-card');
    if (cards.length > 0) {
      const inp = cards[cards.length - 1].querySelector('input[type="text"]');
      if (inp) inp.focus();
    }
  });

  btnClear.addEventListener('click', () => { editingProps = []; renderCards(); });

  btnSave.addEventListener('click', () => {
    const validProps = editingProps
      .filter(p => p.Name.trim())
      .map(p => {
        const out = { Name: p.Name.trim(), Type: p.Type, Value: p.Value };
        if (p.Type === 'enum' && p.Choices && p.Choices.length > 0) out.Choices = [...p.Choices];
        if ((p.Type === 'integer' || p.Type === 'double') && p.Min !== undefined && p.Min !== '') out.Min = p.Min;
        if ((p.Type === 'integer' || p.Type === 'double') && p.Max !== undefined && p.Max !== '') out.Max = p.Max;
        if (p.Header) out.Header = p.Header.trim();
        if (p.Comment) out.Comment = p.Comment.trim();
        if (p.Description) out.Description = p.Description.trim();
        return out;
      });
    dataModel.setDesignProperties(validProps);
    close();
    onSaved();
  });

  btnCancel.addEventListener('click', close);
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}
