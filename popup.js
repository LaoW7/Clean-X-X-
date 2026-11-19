const form = document.querySelector('form');
const enabled = document.querySelector('#enabled');
const mediaOptions = document.querySelector('#media-options');
const errorMessage = document.querySelector('#error');
const latestChanges = new Map();
let settings = cleanXSettings.defaults;

function render() {
  enabled.checked = settings.enabled;
  mediaOptions.disabled = !settings.enabled;
  form.elements.media.value = settings.media;
}

async function init() {
  try {
    settings = await cleanXSettings.read();
    enabled.disabled = false;
    render();
  } catch {
    errorMessage.textContent = '无法读取设置，请重新打开扩展。';
    return;
  }

  form.addEventListener('change', async ({ target }) => {
    const name = target.name;
    const value = target === enabled ? target.checked : target.value;
    const previousValue = settings[name];
    const change = Symbol();
    latestChanges.set(name, change);
    errorMessage.textContent = '';

    // Render the user's choice immediately and send each write before the popup can close.
    settings = { ...settings, [name]: value };
    render();

    try {
      await chrome.storage.local.set({ [name]: value });
    } catch {
      if (latestChanges.get(name) !== change) return;
      const saved = await cleanXSettings.read().catch(() => null);
      if (latestChanges.get(name) !== change) return;

      // Recover only the failed field so a pending change to the other field stays visible.
      settings = { ...settings, [name]: saved?.[name] ?? previousValue };
      render();
      errorMessage.textContent = '设置未保存，请重试。';
    }
  });
}

init();
