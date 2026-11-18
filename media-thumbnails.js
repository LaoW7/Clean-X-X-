const cleanXThumbnails = (() => {
  const gridSelector = '[data-xclean-thumbnails]';
  const postSelector = '[data-testid="tweet"]';
  const permalinkSelector = 'a[href*="/status/"]:has(time)';
  const previewUrl = /^https:\/\/pbs\.(?:twimg|x)\.com\/(?:media|(?:amplify|ext_tw|tweet)_video_thumb)\//i;
  const recentSources = new Map();
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
      for (const url of [element.currentSrc, element.src, responsive, element.poster, background]) {
        if (!previewUrl.test(url ?? '')) continue;
        const key = sourceKey(url);
        if (!sources.has(key)) sources.set(key, url);
      }
    }
    return [...sources.values()].slice(0, 4);
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
      image.alt = label.textContent;
      image.decoding = 'async';
      image.hidden = true;
      image.addEventListener('load', () => {
        image.hidden = false;
        label.hidden = true;
      });
      image.addEventListener('error', () => {
        image.hidden = true;
        label.hidden = false;
      });
      tile.append(image);
      image.src = source;
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
      const observed = collectSources(block);
      const sources = observed.every(url => saved.some(savedUrl => sourceKey(savedUrl) === sourceKey(url)))
        ? saved : observed;

      // Keep the still frame when X replaces the preview with an inline player.
      if (key && sources.length) {
        recentSources.delete(key);
        recentSources.set(key, sources);
        if (recentSources.size > 128) recentSources.delete(recentSources.keys().next().value);
      }

      if (existing?.postUrl !== postUrl || sources.join('\n') !== existing?.sources.join('\n')) {
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
