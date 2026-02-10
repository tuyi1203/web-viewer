const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 获取所有数据
  getAllData: () => ipcRenderer.invoke('bookmark:getAll'),
  
  // 文件夹操作
  getFolders: () => ipcRenderer.invoke('bookmark:getFolders'),
  addFolder: (name) => ipcRenderer.invoke('bookmark:addFolder', name),
  updateFolder: (id, data) => ipcRenderer.invoke('bookmark:updateFolder', { id, data }),
  deleteFolder: (id) => ipcRenderer.invoke('bookmark:deleteFolder', id),
  
  // 书签操作
  getBookmarks: (folderId) => ipcRenderer.invoke('bookmark:getBookmarks', folderId),
  addBookmark: (data) => ipcRenderer.invoke('bookmark:add', data),
  updateBookmark: (id, data) => ipcRenderer.invoke('bookmark:update', { id, data }),
  deleteBookmark: (id) => ipcRenderer.invoke('bookmark:delete', id),
  reorderBookmarks: (orderedIds) => ipcRenderer.invoke('bookmark:reorder', orderedIds),
  
  // 打开浏览器
  openUrl: (url) => ipcRenderer.send('browser:open', url),
  
  // 隐藏面板
  hidePanel: () => ipcRenderer.send('panel:hide'),
  
  // 监听刷新事件
  onRefresh: (callback) => {
    ipcRenderer.on('bookmarks:refresh', callback);
  },
  
  // 更新设置
  updateSettings: (data) => ipcRenderer.invoke('settings:update', data),

  // 导入/导出
  importBookmarks: () => ipcRenderer.invoke('bookmark:import'),
  exportBookmarks: () => ipcRenderer.invoke('bookmark:export'),
  
  // 调试日志
  debugLog: (payload) => ipcRenderer.send('log:debug', payload)
});
