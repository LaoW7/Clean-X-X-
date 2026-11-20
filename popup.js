const form = document.querySelector('form');
const enabled = document.querySelector('#enabled');
const workMode = document.querySelector('#work-mode');
const mediaOptions = document.querySelector('#media-options');
const mediaNote = document.querySelector('#media-note');
const errorMessage = document.querySelector('#error');
const latestChanges = new Map();
let settings = cleanXSettings.defaults;

function render() {
  enabled.checked = settings.enabled;
  workMode.checked = settings.workMode;
  mediaOptions.disabled = !settings.enabled || settings.workMode;
  form.elements.media.value = settings.media;
  mediaNote.textContent = settings.workMode
    ? '工作模式已开启。媒体仅在帖子详情中显示。'
    : '适用于帖子里的图片、GIF 和视频。点开帖子可查看完整媒体。';
}

async function init() {
  try {
    settings = await cleanXSettings.read();
    enabled.disabled = false;
    workMode.disabled = false;
    render();
  } catch {
    errorMessage.textContent = '无法读取设置，请重新打开扩展。';
    return;
  }

  form.addEventListener('change', async ({ target }) => {
    const name = target.name;
    const value = target.type === 'checkbox' ? target.checked : target.value;
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
