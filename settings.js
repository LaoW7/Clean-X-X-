const cleanXSettings = Object.freeze({
  defaults: Object.freeze({ enabled: true, workMode: false, media: 'hidden' }),

  normalize({ enabled, workMode, media }) {
    return {
      enabled: enabled !== false,
      workMode: workMode === true,
      media: ['hidden', 'compact', 'original'].includes(media) ? media : 'hidden',
    };
  },

  async read() {
    return this.normalize(await chrome.storage.local.get(this.defaults));
  },

  subscribe(onChange) {
    chrome.storage.local.onChanged.addListener(onChange);
  },
});
