const path = require('path');

/**
 * 将文本中的常见 HTML 实体解码为原字符
 */
function decodeHtmlEntities(input) {
  if (!input) return '';
  let text = String(input);
  const named = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  };
  Object.entries(named).forEach(([k, v]) => {
    text = text.split(k).join(v);
  });
  text = text.replace(/&#(\d+);/g, (_, num) => {
    const code = parseInt(num, 10);
    if (!Number.isFinite(code)) return _;
    try {
      return String.fromCodePoint(code);
    } catch (e) {
      return _;
    }
  });
  return text;
}

/**
 * 对 Netscape/Chrome 书签 HTML 中的文本做基础清理
 */
function normalizeBookmarkText(input) {
  return decodeHtmlEntities(String(input || '').trim());
}

/**
 * 解析 Chrome 导出的书签 HTML（Netscape Bookmark File）为扁平条目列表
 * @returns {{ folderPath: string[], title: string, url: string }[]}
 */
function parseChromeBookmarksHtml(html) {
  const input = String(html || '');
  const tokenRe =
    /<DT>\s*<H3[^>]*>([^<]*)<\/H3>|<DT>\s*<A[^>]*HREF="([^"]+)"[^>]*>([^<]*)<\/A>|<DL[^>]*>|<\/DL>/gi;
  const folderStack = [];
  let pendingFolder = null;
  const items = [];
  let match;
  while ((match = tokenRe.exec(input))) {
    const folderName = match[1];
    const href = match[2];
    const linkTitle = match[3];
    const token = match[0];

    if (typeof folderName === 'string' && folderName.length >= 0) {
      pendingFolder = normalizeBookmarkText(folderName);
      continue;
    }

    if (token && token.toLowerCase().startsWith('<dl')) {
      if (pendingFolder) {
        folderStack.push(pendingFolder);
        pendingFolder = null;
      } else {
        folderStack.push('');
      }
      continue;
    }

    if (token && token.toLowerCase() === '</dl>') {
      folderStack.pop();
      pendingFolder = null;
      continue;
    }

    if (href) {
      const url = normalizeBookmarkText(href);
      const title = normalizeBookmarkText(linkTitle || url);
      if (!url || /^javascript:/i.test(url)) continue;
      items.push({
        folderPath: folderStack.filter(Boolean),
        title,
        url
      });
    }
  }
  return items;
}

/**
 * 生成 Chrome 可导入的 Netscape Bookmark HTML（不包含嵌套文件夹，按应用文件夹平铺导出）
 */
function generateChromeBookmarksHtml({ folders, bookmarks, title = 'Bookmarks' }) {
  const escapeHtml = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const sortedFolders = (Array.isArray(folders) ? folders : []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const byFolder = new Map();
  (Array.isArray(bookmarks) ? bookmarks : []).forEach((b) => {
    const list = byFolder.get(b.folderId) || [];
    list.push(b);
    byFolder.set(b.folderId, list);
  });
  byFolder.forEach((list, folderId) => {
    byFolder.set(
      folderId,
      list.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
    );
  });

  const lines = [];
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push(`<TITLE>${escapeHtml(title)}</TITLE>`);
  lines.push(`<H1>${escapeHtml(title)}</H1>`);
  lines.push('<DL><p>');
  for (const folder of sortedFolders) {
    const list = byFolder.get(folder.id) || [];
    if (!list.length) continue;
    lines.push(`  <DT><H3>${escapeHtml(folder.name)}</H3>`);
    lines.push('  <DL><p>');
    for (const bm of list) {
      lines.push(`    <DT><A HREF="${escapeHtml(bm.url)}">${escapeHtml(bm.name || bm.url)}</A>`);
    }
    lines.push('  </DL><p>');
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}

/**
 * 导出应用书签为“应用备份 JSON”格式（用于后续无损合并导入）
 */
function exportAppBackupJson({ folders, bookmarks, settings }) {
  const payload = {
    format: 'web-viewer-bookmarks',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      folders: Array.isArray(folders) ? folders : [],
      bookmarks: Array.isArray(bookmarks) ? bookmarks : [],
      settings: settings && typeof settings === 'object' ? settings : {}
    }
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * 将“应用备份 JSON”合并导入到现有 store（不修改既有书签/文件夹，仅追加缺失项）
 */
function importAppBackupIntoStore({ json, bookmarkStore, dedupe = true }) {
  const payload = json && json.data ? json.data : json;
  const importedFolders = Array.isArray(payload?.folders) ? payload.folders : [];
  const importedBookmarks = Array.isArray(payload?.bookmarks) ? payload.bookmarks : [];

  const existingFolders = bookmarkStore.getFolders();
  const folderNameToId = new Map(existingFolders.map((f) => [f.name, f.id]));

  const importedFolderIdToName = new Map(importedFolders.map((f) => [f.id, f.name]));

  let addedFolders = 0;
  for (const f of importedFolders) {
    if (!f || typeof f.name !== 'string') continue;
    if (f.id === 'default' || f.name === '默认收藏') {
      if (!folderNameToId.has('默认收藏')) {
        folderNameToId.set('默认收藏', 'default');
      }
      continue;
    }
    if (!folderNameToId.has(f.name)) {
      const created = bookmarkStore.addFolder(f.name);
      folderNameToId.set(created.name, created.id);
      addedFolders += 1;
    }
  }

  const existingBookmarks = bookmarkStore.getAllBookmarks();
  const existingKey = new Set(existingBookmarks.map((b) => `${b.folderId}::${b.url}`));

  const byTargetFolderName = new Map();
  for (const b of importedBookmarks.slice().sort((a, b2) => (a.order || 0) - (b2.order || 0))) {
    if (!b || typeof b.url !== 'string') continue;
    const folderName = importedFolderIdToName.get(b.folderId) || '默认收藏';
    const list = byTargetFolderName.get(folderName) || [];
    list.push(b);
    byTargetFolderName.set(folderName, list);
  }

  let addedBookmarks = 0;
  let skippedBookmarks = 0;
  for (const [folderName, list] of byTargetFolderName.entries()) {
    const folderId = folderNameToId.get(folderName) || 'default';
    for (const b of list) {
      const key = `${folderId}::${b.url}`;
      if (dedupe && existingKey.has(key)) {
        skippedBookmarks += 1;
        continue;
      }
      bookmarkStore.addBookmark({
        folderId,
        name: b.name || b.url,
        url: b.url,
        icon: b.icon || ''
      });
      existingKey.add(key);
      addedBookmarks += 1;
    }
  }

  return { addedFolders, addedBookmarks, skippedBookmarks };
}

/**
 * 将 Chrome 书签 HTML 合并导入到现有 store（以“Chrome导入 / 路径”平铺保存）
 */
function importChromeHtmlIntoStore({ html, bookmarkStore, rootFolderName = 'Chrome导入', dedupe = true }) {
  const items = parseChromeBookmarksHtml(html);

  const existingFolders = bookmarkStore.getFolders();
  const folderNameToId = new Map(existingFolders.map((f) => [f.name, f.id]));

  if (!folderNameToId.has(rootFolderName)) {
    const created = bookmarkStore.addFolder(rootFolderName);
    folderNameToId.set(created.name, created.id);
  }

  const existingBookmarks = bookmarkStore.getAllBookmarks();
  const existingKey = new Set(existingBookmarks.map((b) => `${b.folderId}::${b.url}`));

  let addedFolders = 0;
  let addedBookmarks = 0;
  let skippedBookmarks = 0;
  for (const item of items) {
    const suffix = Array.isArray(item.folderPath) && item.folderPath.length > 0 ? item.folderPath.join(' / ') : '';
    const folderName = suffix ? `${rootFolderName} / ${suffix}` : rootFolderName;
    let folderId = folderNameToId.get(folderName);
    if (!folderId) {
      const created = bookmarkStore.addFolder(folderName);
      folderId = created.id;
      folderNameToId.set(folderName, folderId);
      addedFolders += 1;
    }

    const key = `${folderId}::${item.url}`;
    if (dedupe && existingKey.has(key)) {
      skippedBookmarks += 1;
      continue;
    }
    bookmarkStore.addBookmark({
      folderId,
      name: item.title || item.url,
      url: item.url,
      icon: ''
    });
    existingKey.add(key);
    addedBookmarks += 1;
  }

  return { addedFolders, addedBookmarks, skippedBookmarks };
}

/**
 * 根据文件名/内容判断导入类型，并完成导入（支持 Chrome HTML 与应用备份 JSON）
 */
function importBookmarksFromFile({ filePath, fileContent, bookmarkStore }) {
  const ext = path.extname(filePath || '').toLowerCase();
  const text = String(fileContent || '');

  const looksLikeChromeHtml =
    ext === '.html' ||
    ext === '.htm' ||
    /NETSCAPE-Bookmark-file-1/i.test(text) ||
    (/<DL/i.test(text) && /<A/i.test(text) && /HREF=/i.test(text));

  if (looksLikeChromeHtml) {
    const stats = importChromeHtmlIntoStore({ html: text, bookmarkStore });
    return { format: 'chrome-html', ...stats };
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('无法识别的导入文件：请选择 Chrome 导出的 HTML 或应用导出的 JSON');
  }
  const stats = importAppBackupIntoStore({ json, bookmarkStore });
  return { format: 'app-json', ...stats };
}

module.exports = {
  parseChromeBookmarksHtml,
  generateChromeBookmarksHtml,
  exportAppBackupJson,
  importBookmarksFromFile
};

