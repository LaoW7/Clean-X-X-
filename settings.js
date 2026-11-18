const cleanXSettings = Object.freeze({
  defaults: Object.freeze({ enabled: true, media: 'hidden' }),

  normalize({ enabled, media }) {
    return {
      enabled: enabled !== false,
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
