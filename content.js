(() => {
  const root = document.documentElement;
  const columnSelector = '[data-testid="primaryColumn"]';
  const postSelector = '[data-testid="tweet"]';
  const textSelector = '[data-testid="tweetText"]';
  const cardPreview = 'data-xclean-card-preview';
  const cardLink = 'data-xclean-card-link';
  const ownPreviewSelector = `[${cardLink}], [data-xclean-thumbnails]`;
  const watchedAttributes = ['data-testid', 'href', 'role', 'src', 'srcset', 'poster', 'aria-label', 'title'];
  const cardSelector = [
    '[data-testid="card.wrapper"]',
    '[data-testid^="card.layoutLarge"]',
    '[data-testid^="card.layoutSmall"]',
    'a[href]:is([aria-label], [target="_blank"]):has(img, [style*="background-image"])',
  ].join(', ');
  const mediaSelector = [
    '[data-testid="tweetPhoto"]',
    '[data-testid="videoPlayer"]',
    '[data-testid="videoComponent"]',
    '[data-testid="previewInterstitial"]',
    'img[src^="https://pbs.twimg.com/media/"]',
    'img[src*="_video_thumb/"]',
    'video[poster]',
    'a[href*="/status/"]:is([href*="/photo/"], [href*="/video/"]):has(img, video)',
  ].join(', ');
  const preservedSelector = [
    textSelector,
    '[data-testid="User-Name"]',
    '[data-testid^="Tweet-User-Avatar"]',
    '[data-testid="socialContext"]',
    '[data-testid="card.wrapper"]',
    `[${cardPreview}]`,
    `[${cardLink}]`,
    '[data-xclean-thumbnails]',
    '[data-testid^="cardPoll"]',
    '[data-testid="ArticleCoverImage"]',
    '[data-testid="reply"]',
    '[data-testid="like"]',
    '[data-testid="unlike"]',
    '[data-testid="retweet"]',
    'a:has(> time)',
    'article',
  ].join(', ');

  let settings = cleanXSettings.defaults;
  let observing = false;
  let frame = 0;
  let columns = new Set();
  const pendingPosts = new Set();

  function externalLink(element) {
    return /^https?:$/.test(element.protocol) &&
      !/(^|\.)(?:x\.com|twitter\.com)$/i.test(element.hostname);
  }

  function isCardFooter(footer, source) {
    if (!footer?.matches('div, a') || footer.matches(textSelector) ||
        footer.querySelector(preservedSelector)) return false;

    const links = footer.matches('a[href]') ? [footer] : footer.querySelectorAll('a[href]');
    if (links.length) return links.length === 1 && links[0].href === source.href;

    // Some cards render their source as a text caption next to the preview.
    const domain = footer.textContent.trim().match(/^(?:From|来自|來自)\s*[:：]?\s*([\w.-]+\.[a-z\d-]+)$/i)?.[1];
    if (!domain) return false;
    const firstWord = source.getAttribute('aria-label')?.trim().split(/\s+/, 1)[0];
    return [source.hostname, firstWord?.toLowerCase()].includes(domain.toLowerCase());
  }

  function simplifyCards(post) {
    const previews = new Set();
    const links = new Set();
    const bodyLinks = new Set(Array.from(post.querySelectorAll(`${textSelector} a[href]`), (link) => link.href));

    for (const card of post.querySelectorAll(cardSelector)) {
      const preview = card.closest('a[href]') ?? card;
      if (preview.closest(postSelector) !== post || preview.closest(textSelector) ||
          preview.querySelector('[data-testid="ArticleCoverImage"], [data-testid^="cardPoll"]') ||
          [...previews].some((container) => container.contains(preview))) continue;

      const candidates = preview.matches('a[href]') ? [preview] : preview.querySelectorAll('a[href]');
      const source = Array.from(candidates).find((link) => !link.hasAttribute(cardLink) && externalLink(link));
      if (!source) continue;

      previews.add(preview);
      const sibling = preview.nextElementSibling;
      const existing = sibling?.hasAttribute(cardLink) ? sibling : null;
      const footer = existing ? existing.nextElementSibling : sibling;
      if (preview.matches('[data-testid="card.wrapper"]') && isCardFooter(footer, source)) {
        previews.add(footer);
      }

      if (bodyLinks.has(source.href)) continue;
      const link = existing ?? document.createElement('a');
      const label = source.getAttribute('aria-label')?.trim() || source.getAttribute('title')?.trim() ||
        (source.hostname === 't.co' ? source.hostname + source.pathname : source.host);

      if (link.href !== source.href) link.href = source.href;
      if (link.textContent !== label) link.textContent = label;
      if (!existing) {
        link.setAttribute(cardLink, '');
        link.dir = 'auto';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.addEventListener('click', (event) => event.stopPropagation());
        preview.after(link);
      }
      links.add(link);
    }

    // X can reuse a post element or replace a card after it first appears.
    for (const element of post.querySelectorAll(`[${cardPreview}], [${cardLink}]`)) {
      if (element.closest(postSelector) !== post) continue;
      if (element.hasAttribute(cardLink) && !links.has(element)) element.remove();
      else if (!previews.has(element)) element.removeAttribute(cardPreview);
    }
    for (const preview of previews) preview.toggleAttribute(cardPreview, true);
  }

  function mediaBlock(media, post) {
    // X wraps media in aspect-ratio boxes and sometimes adds a carousel.
    // Collapse the whole attachment while stopping at any sibling post content.
    let block = media;
    for (let parent = block.parentElement; parent !== post; parent = parent.parentElement) {
      if (parent.matches(preservedSelector) || parent.querySelector(preservedSelector)) break;
      if (parent.matches('[role="link"]:not(a)') && !parent.matches(mediaSelector)) break;
      block = parent;
    }
    return block;
  }

  function markMedia(post) {
    const marked = post.querySelectorAll('[data-xclean-attachment]');
    const blocks = new Set();

    for (const media of post.querySelectorAll(mediaSelector)) {
      if (media.closest(postSelector) === post &&
          !media.closest(`${textSelector}, [${cardPreview}], [data-xclean-thumbnails]`)) {
        blocks.add(mediaBlock(media, post));
      }
    }

    for (const block of marked) {
      if (block.closest(postSelector) === post && !blocks.has(block)) {
        block.removeAttribute('data-xclean-attachment');
      }
    }
    for (const block of blocks) block.setAttribute('data-xclean-attachment', '');

    if (root.getAttribute('data-xclean-media') === 'compact') {
      const allBlocks = [...blocks];
      const outerBlocks = allBlocks.filter(block => !allBlocks.some(other => other !== block && other.contains(block)));
      cleanXThumbnails.update(post, outerBlocks);
    }
  }

  function updatePost(post) {
    if (!post.isConnected || !post.closest(columnSelector) ||
        post.closest('[role="dialog"], #layers')) return;

    simplifyCards(post);
    if (root.hasAttribute('data-xclean-media')) markMedia(post);
  }

  function queuePostTree(node) {
    if (!(node instanceof Element) || node.matches(ownPreviewSelector)) return;
    if (node.matches(postSelector)) pendingPosts.add(node);
    for (const descendant of node.querySelectorAll(postSelector)) pendingPosts.add(descendant);
  }

  function schedulePosts() {
    if (!pendingPosts.size || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const post of pendingPosts) updatePost(post);
      pendingPosts.clear();
    });
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.attributeName === 'style' && !record.target.style?.backgroundImage.includes('pbs.')) continue;
      if (record.target.closest?.(ownPreviewSelector)) continue;
      if (record.addedNodes.length && !record.removedNodes.length &&
          Array.from(record.addedNodes).every(node => node instanceof Element && node.matches(ownPreviewSelector))) continue;
      const post = record.target.closest?.(postSelector);
      if (post) pendingPosts.add(post);
      if (record.type === 'attributes' && ['data-testid', 'role'].includes(record.attributeName)) {
        queuePostTree(record.target);
      }
      for (const node of record.addedNodes) queuePostTree(node);
    }
    schedulePosts();
  });

  function observeColumns() {
    observer.disconnect();
    const attributeFilter = root.getAttribute('data-xclean-media') === 'compact'
      ? [...watchedAttributes, 'alt', 'style'] : watchedAttributes;
    for (const column of columns) {
      observer.observe(column, { childList: true, subtree: true, attributes: true, attributeFilter });
    }
  }

  function refreshPosts() {
    for (const column of columns) {
      for (const post of column.querySelectorAll(postSelector)) updatePost(post);
    }
  }

  function syncColumns() {
    const current = new Set(document.querySelectorAll(columnSelector));
    if (current.size === columns.size && [...current].every(column => columns.has(column))) return;
    columns = current;
    observeColumns();
    refreshPosts();
  }

  // Track which columns X mounts. Detailed mutations only matter within those columns.
  const columnTracker = new MutationObserver(records => {
    if ([...columns].some(column => !column.isConnected || !column.matches(columnSelector)) ||
        records.some(record => record.type === 'attributes'
          ? record.target.matches(columnSelector) && !columns.has(record.target)
          : !record.target.closest?.(columnSelector) && Array.from(record.addedNodes).some(node =>
            node instanceof Element && (node.matches(columnSelector) || node.querySelector(columnSelector))))) {
      syncColumns();
    }
  });

  function isPostDetail(path) {
    return /\/(?:status|article)\/\d+(?:\/|$)/i.test(path);
  }

  function isTimeline(path) {
    return !isPostDetail(path) && !/^\/(?:compose|settings|messages|i\/chat|i\/flow)(?:\/|$)/i.test(path);
  }

  function apply() {
    const simplifyTimeline = settings.enabled && isTimeline(location.pathname);
    const mediaMode = simplifyTimeline && settings.media !== 'original' ? settings.media : null;
    const previousMedia = root.getAttribute('data-xclean-media');

    root.toggleAttribute('data-xclean-enabled', settings.enabled);
    root.toggleAttribute('data-xclean-text-links', simplifyTimeline);
    if (mediaMode !== previousMedia) {
      if (mediaMode) root.setAttribute('data-xclean-media', mediaMode);
      else root.removeAttribute('data-xclean-media');
    }

    if (simplifyTimeline === observing) {
      if (simplifyTimeline && mediaMode !== previousMedia) {
        observeColumns();
        refreshPosts();
      }
      return;
    }
    observing = simplifyTimeline;
    if (observing) {
      columnTracker.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-testid'],
      });
      syncColumns();
    } else {
      columnTracker.disconnect();
      observer.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
      columns.clear();
      pendingPosts.clear();
    }
  }

  trackCleanXTimelinePosition({ enabled: () => settings.enabled, isTimeline, isDetail: isPostDetail, onPageChange: apply });
  window.addEventListener('pageshow', apply);
  const changesAtStartup = {};
  cleanXSettings.subscribe((changes) => {
    if (!changes.enabled && !changes.media) return;
    const values = {};
    if (changes.enabled) values.enabled = changes.enabled.newValue;
    if (changes.media) values.media = changes.media.newValue;
    Object.assign(changesAtStartup, values);
    settings = cleanXSettings.normalize({ ...settings, ...values });
    apply();
  });
  cleanXSettings.read().then((stored) => {
    settings = cleanXSettings.normalize({ ...stored, ...changesAtStartup });
    apply();
  }).catch(() => apply());
})();
