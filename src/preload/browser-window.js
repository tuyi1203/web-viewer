const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 透明度控制
  setOpacity: (value) => ipcRenderer.send('browser:setOpacity', value),
  getOpacity: () => ipcRenderer.invoke('browser:getOpacity'),
  
  // 置顶控制
  toggleAlwaysOnTop: () => ipcRenderer.invoke('browser:toggleAlwaysOnTop'),
  
  // 窗口控制
  minimize: () => ipcRenderer.send('browser:minimize'),
  close: () => ipcRenderer.send('browser:close'),
  
  // 最大化控制
  toggleMaximize: () => ipcRenderer.invoke('browser:toggleMaximize'),
  isMaximized: () => ipcRenderer.invoke('browser:isMaximized'),
  
  // 平板模式
  toggleTabletMode: () => ipcRenderer.invoke('browser:toggleTabletMode'),
  
  // 窗口拖动
  moveBy: (deltaX, deltaY) => ipcRenderer.send('browser:moveBy', deltaX, deltaY),
  lockSize: () => ipcRenderer.send('browser:lockSize'),
  unlockSize: () => ipcRenderer.send('browser:unlockSize'),
  
  // 画中画模式
  setPictureInPicture: (enabled) => ipcRenderer.send('browser:pip', enabled),
  
  // 监听加载URL事件
  onLoadUrl: (callback) => {
    ipcRenderer.on('browser:loadUrl', (event, url) => callback(url));
  },
  
  // 收藏相关
  isBookmarked: (url) => ipcRenderer.invoke('bookmark:isBookmarked', url),
  addBookmark: (data) => ipcRenderer.invoke('bookmark:add', data),
  deleteBookmark: (id) => ipcRenderer.invoke('bookmark:delete', id),
  getFolders: () => ipcRenderer.invoke('bookmark:getFolders'),
  
  // 获取设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  
  // 调试日志
  debugLog: (payload) => ipcRenderer.send('log:debug', payload)
});
