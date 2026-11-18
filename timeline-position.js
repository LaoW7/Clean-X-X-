function trackCleanXTimelinePosition({ enabled, isTimeline, isDetail, onPageChange }) {
  const historyEntries = window.navigation;
  const positions = new Map();
  let clickedPosition;
  let savedBeforeCommit;
  let lastPosition;
  let restoreTimer;

  function timelinePosts() {
    return document.querySelectorAll(
      '[data-testid="primaryColumn"] [data-testid="tweet"]:not(:is(#layers, [role="dialog"]) *)',
    );
  }

  function postId(post) {
    const permalink = post.querySelector('a[href*="/status/"]:has(time)');
    return permalink?.pathname.match(/\/status\/(\d+)(?:\/|$)/)?.[1];
  }

  function capture() {
    const posts = timelinePosts();
    if (!posts.length) return;
    const y = window.scrollY;
    const anchors = [];
    if (y > 1) {
      for (const post of posts) {
        const rect = post.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight || !rect.height) continue;
        const id = postId(post);
        if (id) anchors.push({ id, top: rect.top });
      }
    }
    anchors.sort((a, b) => a.top - b.top);
    return { y, anchors: anchors.slice(0, 3) };
  }

  function remember(entry) {
    const click = clickedPosition;
    const spot = click?.key === entry.key && performance.now() - click.time < 1000
      ? click.spot
      : capture();
    if (!spot) return;
    lastPosition = { ...spot, url: entry.url };
    positions.delete(entry.key);
    positions.set(entry.key, lastPosition);
    if (positions.size > 16) positions.delete(positions.keys().next().value);
  }

  function stopRestoring() {
    clearTimeout(restoreTimer);
    restoreTimer = undefined;
  }

  function restore(position) {
    const deadline = performance.now() + 3000;
    let alignedSince;

    function attempt() {
      const now = performance.now();
      if (!enabled() || now >= deadline) return stopRestoring();

      const posts = timelinePosts();
      if (posts.length) {
        const candidates = new Map();
        for (const post of posts) {
          const id = postId(post);
          if (id && !candidates.has(id)) candidates.set(id, post);
        }
        const anchor = position.anchors.find(({ id }) => candidates.get(id)?.getClientRects().length);
        const y = window.scrollY;
        const target = anchor
          ? y + candidates.get(anchor.id).getBoundingClientRect().top - anchor.top
          : position.y;
        const scrollable = document.scrollingElement;
        const max = Math.max(0, scrollable.scrollHeight - scrollable.clientHeight);
        const clamped = Math.max(0, Math.min(max, target));

        // Moving to the available offset also lets X remount off-screen posts.
        if (Math.abs(y - clamped) > 1) window.scrollTo({ top: clamped, behavior: 'instant' });
        if ((anchor || !position.anchors.length) && target <= max + 1 && Math.abs(y - clamped) <= 1) {
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
        !event.target.closest?.('[data-testid="primaryColumn"] [data-testid="tweet"]')) return;

    const control = event.target.closest('a[href], button, [role="button"]');
    if (control && (control.origin !== location.origin || !isDetail(control.pathname))) return;
    clickedPosition = { key: historyEntries.currentEntry.key, time: performance.now(), spot: capture() };
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
    if (!from?.url || from.url === entry.url) return onPageChange();
    stopRestoring();
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
