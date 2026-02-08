const floatingBall = document.getElementById('floatingBall');
const ballInner = document.querySelector('.ball-inner');

let isDragging = false;
let hasMoved = false;
let dragStartX = 0;
let dragStartY = 0;

// 鼠标按下
floatingBall.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // 只处理左键
  
  isDragging = true;
  hasMoved = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  
  floatingBall.classList.add('dragging');
  
  // 捕获鼠标
  e.preventDefault();
  e.stopPropagation();
});

// 全局鼠标移动
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  const deltaX = e.screenX - dragStartX;
  const deltaY = e.screenY - dragStartY;
  
  // 检测是否有实际移动
  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    hasMoved = true;
    
    // 更新起始点为当前点，实现增量移动
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    
    // 通过IPC更新窗口位置（增量方式）
    window.api.moveBy(deltaX, deltaY);
  }
});

// 全局鼠标释放
window.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  
  isDragging = false;
  floatingBall.classList.remove('dragging');
  
  // 如果没有移动过，视为点击
  if (!hasMoved) {
    // 使用延时以区分单击和双击
    // 但为了响应速度，目前允许双击时先触发单击（显示面板），随后双击事件会打开浏览器并隐藏面板
    window.api.togglePanel();
  }
  
  hasMoved = false;
});

// 双击打开默认浏览器
floatingBall.addEventListener('dblclick', (e) => {
  if (e.button !== 0) return;
  window.api.openDefaultBrowser();
});

// 右键菜单
floatingBall.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.api.showContextMenu();
});
