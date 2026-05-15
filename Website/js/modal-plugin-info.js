export function initPluginInfoModal({ dataModel, settings, onSaved }) {
  const overlay     = document.getElementById('plugininfo-overlay');
  const btnOpen     = document.getElementById('btn-plugin-info');
  const btnSave     = document.getElementById('plugininfo-save');
  const btnCancel   = document.getElementById('plugininfo-cancel');
  const btnClose    = document.getElementById('plugininfo-close');
  const btnClear    = document.getElementById('plugininfo-clear');
  const btnGenId    = document.getElementById('pi-generate-id');

  const fields = {
    Name:         document.getElementById('pi-name'),
    Version:      document.getElementById('pi-version'),
    Id:           document.getElementById('pi-id'),
    Description:  document.getElementById('pi-description'),
    BuildVersion: document.getElementById('pi-build-version'),
    Author:       document.getElementById('pi-author'),
    Manufacturer: document.getElementById('pi-manufacturer'),
    Model:        document.getElementById('pi-model'),
    IsManaged:    document.getElementById('pi-is-managed'),
    Type:         document.getElementById('pi-type'),
    ShowDebug:    document.getElementById('pi-show-debug'),
  };

  function populate() {
    const pi = dataModel.getPluginInfo() || {};
    fields.Name.value         = pi.Name || '';
    fields.Version.value      = pi.Version || '';
    fields.Id.value           = pi.Id || '';
    fields.Description.value  = pi.Description || '';
    fields.BuildVersion.value = pi.BuildVersion || '';
    fields.Author.value       = pi.Author || '';
    fields.Manufacturer.value = pi.Manufacturer || '';
    fields.Model.value        = pi.Model || '';
    fields.IsManaged.checked  = !!pi.IsManaged;
    fields.Type.value         = pi.Type || '';
    fields.ShowDebug.checked  = !!pi.ShowDebug;

    if (!fields.Author.value && settings.get('authorName')) {
      fields.Author.value = settings.get('authorName');
    }
  }

  function generateUUID() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function close() { overlay.hidden = true; }

  btnOpen.addEventListener('click', () => { populate(); overlay.hidden = false; });
  btnGenId.addEventListener('click', () => { fields.Id.value = generateUUID(); });

  btnClear.addEventListener('click', () => {
    for (const el of Object.values(fields)) {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    }
  });

  btnSave.addEventListener('click', () => {
    const info = {
      Name:         fields.Name.value.trim(),
      Version:      fields.Version.value.trim(),
      Id:           fields.Id.value.trim(),
      Description:  fields.Description.value.trim(),
      BuildVersion: fields.BuildVersion.value.trim(),
      Author:       fields.Author.value.trim(),
      Manufacturer: fields.Manufacturer.value.trim(),
      Model:        fields.Model.value.trim(),
      IsManaged:    fields.IsManaged.checked,
      Type:         fields.Type.value.trim(),
      ShowDebug:    fields.ShowDebug.checked,
    };
    const hasContent = info.Name || info.Version || info.Id || info.Description ||
      info.BuildVersion || info.Author || info.Manufacturer || info.Model ||
      info.IsManaged || info.Type || info.ShowDebug;
    dataModel.setPluginInfo(hasContent ? info : null);
    close();
    onSaved();
  });

  btnCancel.addEventListener('click', close);
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}
