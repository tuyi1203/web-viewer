const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 更新悬浮球位置（绝对位置）
  updatePosition: (x, y) => {
    ipcRenderer.send('ball:updatePosition', { x, y });
  },
  
  // 移动悬浮球（增量移动）
  moveBy: (deltaX, deltaY) => {
    ipcRenderer.send('ball:moveBy', { deltaX, deltaY });
  },
  
  // 切换收藏夹面板
  togglePanel: () => {
    ipcRenderer.send('panel:toggle');
  },
  
  // 打开默认浏览器
  openDefaultBrowser: () => {
    ipcRenderer.send('browser:openDefault');
  },
  
  // 显示右键菜单
  showContextMenu: () => {
    ipcRenderer.send('app:showContextMenu');
  }
});
