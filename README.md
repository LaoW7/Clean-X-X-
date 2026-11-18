# Clean X (清简 X)

**English** · [简体中文](README.zh-CN.md)

Clean X is a Chrome extension that makes X easier to read. It centers the timeline, keeps Home and Explore in the main navigation, and gives you control over how much space media takes up.

## Features

- **A centered timeline.** The main column stays centered on desktop and adjusts to fit smaller windows. The extension hides the right-side trends, recommendations, and other sidebar panels, as well as promoted posts it can identify in the feed.
- **Home, Explore, and search.** The left navigation keeps Home and Explore. At a viewport width of 1,080 CSS pixels or more, the extension keeps X’s native search box and suggestions on the right when the page provides them. Use Explore to search in a narrower window.
- **Text links in place of large previews.** External website cards become single-line links using the original destinations. If the post text already contains the same link, the extension keeps that link. Open the post to see the original preview card.
- **Return to where you were reading.** After you open a post and go back, the extension uses the posts you were looking at to restore your position, even if the height of the timeline changed. If X no longer has those posts loaded, it tries the previous scroll offset. Scrolling manually takes precedence.
- **Settings apply immediately.** Changes are saved in the current Chrome profile and applied to open X tabs. Turn off **启用精简模式** in the extension popup to restore X’s standard interface.

## Timeline media

Open **清简 X** from Chrome’s extensions menu and choose an option under **时间线媒体**. The popup uses the Chinese labels shown below.

| Option in the popup | What it does |
| --- | --- |
| **仅详情页显示** — Show only in post details (default) | Hides images, GIFs, and videos in the timeline. Open the post body or click its timestamp to see the media. |
| **显示缩略图** — Show thumbnails | Limits the media preview to about 192 × 144 pixels. Tall images and multi-image previews may be clipped. |
| **保持原尺寸** — Keep original size | Uses X’s original layout for images, GIFs, and videos. External website previews still appear as text links in the timeline while Clean Mode is on. |

## Install from GitHub

1. On the GitHub repository page, choose **Code → Download ZIP** and extract it. Cloning the repository also works.
2. In Chrome 105 or later, open `chrome://extensions/` and turn on **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Open or refresh [X](https://x.com/). Use the extensions menu to open **清简 X**. You can pin it there for quick access to the controls.

After downloading an update, replace the files in your local extension folder, click **Reload** on the extension card at `chrome://extensions/`, and refresh X.

## Permissions and limits

- Clean X runs on `x.com` and `twitter.com`. It uses the `storage` permission to save the mode and media preferences in your current browser.
- The extension changes how X displays content. X may still download hidden media, and ads that the extension cannot identify may remain visible.
- The extension relies on the structure of X’s pages. A change to X’s layout can require an update to the extension.

## Project files

| File | Purpose |
| --- | --- |
| [manifest.json](manifest.json) | Manifest V3 configuration, supported sites, and permissions |
| [content.js](content.js) and [content.css](content.css) | Layout, content filtering, and link previews |
| [timeline-position.js](timeline-position.js) | Restores the timeline position when returning from a post |
| [popup.html](popup.html), [popup.js](popup.js), and [settings.js](settings.js) | Popup controls and local preferences |

The extension can be loaded directly from the source folder. There is no build step.
