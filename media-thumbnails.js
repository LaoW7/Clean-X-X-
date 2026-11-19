const cleanXThumbnails = (() => {
  const gridSelector = '[data-xclean-thumbnails]';
  const postSelector = '[data-testid="tweet"]';
  const permalinkSelector = 'a[href*="/status/"]:has(time)';
  const previewUrl = /^https:\/\/pbs\.(?:twimg|x)\.com\/(?:media|(?:amplify|ext_tw|tweet)_video_thumb)\//i;
  const recentSources = new Map();
  const failedUrls = new Set();
  const renderedGrids = new WeakMap();

  function sourceKey(url) {
    return url.split('?')[0];
  }

  function collectSources(block) {
    const sources = new Map();
    const selector = 'img, video[poster], [style*="background-image"]';
    const elements = [...block.querySelectorAll(selector)];
    if (block.matches(selector)) elements.unshift(block);

    for (const element of elements) {
      const background = element.style.backgroundImage.match(/url\(["']?(https:\/\/[^"')]+)["']?\)/)?.[1];
      const responsive = element.srcset?.trim().split(/[\s,]/)[0];
      const alt = element.alt?.trim() || '';
      for (const url of [element.currentSrc, element.src, responsive, element.poster, background]) {
        if (!previewUrl.test(url ?? '')) continue;
        const key = sourceKey(url);
        const existing = sources.get(key);
        const preferredUrl = !existing || (failedUrls.has(existing.url) && !failedUrls.has(url))
          ? url : existing.url;
        sources.set(key, { url: preferredUrl, alt: existing?.alt || alt });
      }
    }
    return [...sources.values()].slice(0, 4);
  }

  function reconcileSources(saved, observed) {
    const previous = new Set(saved.map(({ url }) => sourceKey(url)));
    if (observed.some(({ url }) => !previous.has(sourceKey(url)))) return observed;

    const current = new Map(observed.map(source => [sourceKey(source.url), source]));
    return saved.map(source => {
      const replacement = current.get(sourceKey(source.url));
      if (!replacement) return source;
      const url = failedUrls.has(source.url) && !failedUrls.has(replacement.url) ? replacement.url : source.url;
      return { url, alt: replacement.alt || source.alt };
    });
  }

  function makeTile(post, href, source) {
    const tile = document.createElement(href ? 'a' : 'span');
    const label = document.createElement('span');
    label.textContent = '查看媒体';
    tile.append(label);

    if (href) {
      tile.href = href;
      tile.addEventListener('click', event => {
        event.stopPropagation();
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const nativeLink = post.querySelector(permalinkSelector);
        if (nativeLink?.href !== tile.href) return;
        // Use X's own link for same-tab navigation and scroll restoration.
        event.preventDefault();
        nativeLink.click();
      });
    }

    if (source) {
      const image = document.createElement('img');
      image.alt = source.alt || label.textContent;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.setAttribute('data-xclean-thumbnail-pending', '');
      image.setAttribute('aria-hidden', 'true');
      image.addEventListener('load', () => {
        failedUrls.delete(source.url);
        image.removeAttribute('data-xclean-thumbnail-pending');
        image.removeAttribute('aria-hidden');
        label.hidden = true;
      }, { once: true });
      image.addEventListener('error', () => {
        failedUrls.add(source.url);
        if (failedUrls.size > 128) failedUrls.delete(failedUrls.values().next().value);
        image.hidden = true;
        label.hidden = false;
      }, { once: true });
      tile.append(image);
      image.src = source.url;
    }
    return tile;
  }

  function update(post, blocks) {
    const nativeLink = post.querySelector(permalinkSelector);
    const postUrl = nativeLink?.origin === location.origin ? nativeLink.href : '';
    const used = new Set();

    for (const [index, block] of blocks.entries()) {
      const sibling = block.nextElementSibling;
      const grid = sibling?.matches(gridSelector) ? sibling : document.createElement('div');
      const existing = renderedGrids.get(grid);
      const key = postUrl && `${postUrl}#${index}`;
      const saved = recentSources.get(key) ?? (existing?.postUrl === postUrl ? existing.sources : []);
      const sources = reconcileSources(saved, collectSources(block));

      // Keep the still frame when X replaces the preview with an inline player.
      if (key && sources.length) {
        recentSources.delete(key);
        recentSources.set(key, sources);
        if (recentSources.size > 128) recentSources.delete(recentSources.keys().next().value);
      }

      if (existing?.postUrl !== postUrl || sources.length !== existing.sources.length ||
          sources.some(({ url, alt }, index) => url !== existing.sources[index].url || alt !== existing.sources[index].alt)) {
        grid.replaceChildren(...(sources.length ? sources : [null]).map(source => makeTile(post, postUrl, source)));
        renderedGrids.set(grid, { postUrl, sources });
      }
      if (!grid.isConnected) {
        grid.setAttribute('data-xclean-thumbnails', '');
        block.after(grid);
      }
      used.add(grid);
    }

    for (const grid of post.querySelectorAll(gridSelector)) {
      if (used.has(grid) || grid.closest(postSelector) !== post) continue;
      const previous = renderedGrids.get(grid);
      // The player can remove its original node before a replacement is mounted.
      if (!blocks.length && postUrl && previous?.postUrl === postUrl && previous.sources.length) continue;
      grid.remove();
    }
  }

  return { update };
})();
