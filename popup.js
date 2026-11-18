const form = document.querySelector('form');
const enabled = document.querySelector('#enabled');
const mediaOptions = document.querySelector('#media-options');
const errorMessage = document.querySelector('#error');
let settings = cleanXSettings.defaults;

function render() {
  enabled.checked = settings.enabled;
  mediaOptions.disabled = !settings.enabled;
  form.elements.media.value = settings.media;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

async function init() {
  try {
    settings = await cleanXSettings.read();
    enabled.disabled = false;
    render();
  } catch {
    showError('无法读取设置，请重新打开扩展。');
    return;
  }

  form.addEventListener('change', async ({ target }) => {
    errorMessage.hidden = true;
    const value = target === enabled ? target.checked : target.value;

    try {
      await chrome.storage.local.set({ [target.name]: value });
      settings = cleanXSettings.normalize({ ...settings, [target.name]: value });
      render();
    } catch {
      render();
      showError('设置未保存，请重试。');
    }
  });
}

init();
