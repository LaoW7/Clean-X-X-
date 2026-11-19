function trackCleanXTimelinePosition({ enabled, isTimeline, isDetail, onPageChange }) {
  const historyEntries = window.navigation;
  const postSelector = '[data-testid="primaryColumn"] [data-testid="tweet"]:not(:is(#layers, [role="dialog"]) *)';
  const permalinkSelector = 'a[href*="/status/"]:has(time)';
  const positions = new Map();
  let clickedPosition;
  let savedBeforeCommit;
  let lastPosition;
  let restoreTimer;

  function postId(permalink) {
    return permalink?.pathname.match(/\/status\/(\d+)(?:\/|$)/)?.[1];
  }

  function capture() {
    const posts = document.querySelectorAll(postSelector);
    if (!posts.length) return;
    const y = window.scrollY;
    const anchors = [];
    if (y > 1) {
      for (const post of posts) {
        const rect = post.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight || !rect.height ||
            getComputedStyle(post).visibility !== 'visible') continue;
        const id = postId(post.querySelector(permalinkSelector));
        if (id) anchors.push({ id, top: rect.top });
      }
    }
    anchors.sort((a, b) => a.top - b.top);
    return { y, anchors: anchors.slice(0, 3) };
  }

  function remember(entry) {
    const click = clickedPosition;
    const recentClick = click?.key === entry.key && performance.now() - click.time < 1000;
    const spot = (recentClick ? click.spot : undefined) ?? capture();
    positions.delete(entry.key);
    lastPosition = spot && { ...spot, url: entry.url };
    if (!lastPosition) return;
    positions.set(entry.key, lastPosition);
    if (positions.size > 16) positions.delete(positions.keys().next().value);
  }

  function stopRestoring() {
    clearTimeout(restoreTimer);
    restoreTimer = undefined;
  }

  function findAnchorDelta(anchors, selector) {
    if (!selector) return;
    let bestIndex = anchors.length;
    let delta;

    for (const permalink of document.querySelectorAll(selector)) {
      const id = postId(permalink);
      const index = anchors.findIndex(anchor => anchor.id === id);
      if (index < 0 || index >= bestIndex) continue;

      const post = permalink.closest(postSelector);
      if (!post || post.querySelector(permalinkSelector) !== permalink) continue;
      const rect = post.getBoundingClientRect();
      if (!rect.height || getComputedStyle(post).visibility !== 'visible') continue;

      delta = rect.top - anchors[index].top;
      if (index === 0) break;
      bestIndex = index;
    }
    return delta;
  }

  function restore(position) {
    const deadline = performance.now() + 3000;
    // Only query the saved post links while the timeline is remounting.
    const anchorSelector = position.anchors.map(({ id }) => `${postSelector} a[href*="/status/${id}"]:has(time)`).join(', ');
    let alignedSince;

    function attempt() {
      const now = performance.now();
      if (!enabled() || now >= deadline) return stopRestoring();

      const scrollable = document.scrollingElement;
      if (scrollable && document.querySelector(postSelector)) {
        const delta = findAnchorDelta(position.anchors, anchorSelector);
        const y = window.scrollY;
        const target = delta === undefined ? position.y : y + delta;
        const max = Math.max(0, scrollable.scrollHeight - scrollable.clientHeight);
        const clamped = Math.max(0, Math.min(max, target));

        // Moving to the available offset also lets X remount off-screen posts.
        if (Math.abs(y - clamped) > 1) window.scrollTo({ top: clamped, behavior: 'instant' });
        if ((delta !== undefined || !position.anchors.length) && target <= max + 1 && Math.abs(y - clamped) <= 1) {
          alignedSince ??= now;
          if (now - alignedSince >= 400) return stopRestoring();
        } else {
          alignedSince = undefined;
        }
      } else {
        alignedSince = undefined;
      }
      restoreTimer = setTimeout(attempt, 80);
    }

    restoreTimer = setTimeout(attempt, 50);
  }

  // A capture-phase click sees the timeline before X can reset its scroll offset.
  document.addEventListener('click', (event) => {
    clickedPosition = undefined;
    if (!enabled() || !isTimeline(location.pathname) || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        !event.target.closest?.(postSelector)) return;

    const control = event.target.closest('a[href], button, [role="button"]');
    if (control && (control.origin !== location.origin || !isDetail(control.pathname))) return;
    const entry = historyEntries.currentEntry;
    if (entry) clickedPosition = { key: entry.key, time: performance.now(), spot: capture() };
  }, true);

  historyEntries.addEventListener('navigate', ({ destination }) => {
    const entry = historyEntries.currentEntry;
    const url = new URL(destination.url);
    if (enabled() && entry && isTimeline(location.pathname) && url.origin === location.origin && isDetail(url.pathname)) {
      remember(entry);
      savedBeforeCommit = entry.key;
    }
  });

  historyEntries.addEventListener('currententrychange', ({ from, navigationType }) => {
    const entry = historyEntries.currentEntry;
    if (from?.key !== entry?.key || from?.url !== entry?.url) stopRestoring();
    if (!from?.url || !entry?.url || from.url === entry.url) return onPageChange();
    const oldPath = new URL(from.url).pathname;
    const newPath = location.pathname;

    if (enabled() && isTimeline(oldPath) && isDetail(newPath) && savedBeforeCommit !== from.key) remember(from);
    savedBeforeCommit = undefined;
    clickedPosition = undefined;
    onPageChange();

    if (!enabled() || !isDetail(oldPath) || !isTimeline(newPath)) return;
    const saved = navigationType === 'traverse' ? positions.get(entry.key) :
      navigationType === 'replace' ? lastPosition : undefined;
    if (saved?.url === entry.url) restore(saved);
  });

  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'pagehide']) {
    window.addEventListener(type, stopRestoring, { capture: true, passive: true });
  }
}
