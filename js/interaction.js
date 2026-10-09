// interaction.js —— 交互模块
// 鼠标（左键拖动平移 / 滚轮缩放）与键盘（1/2/3 切换模式、空格暂停）事件封装。

window.Interaction = (function () {
  'use strict';

  function init(canvas, cb) {
    var dragging = false;
    var lastX = 0;
    var lastY = 0;

    // 左键按下开始拖动
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    // 拖动过程中把像素增量换算成 NDC 增量（屏幕 y 向下，NDC y 向上）
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cb.onPan(dx * 2 / canvas.width, -dy * 2 / canvas.height);
    });

    window.addEventListener('mouseup', function () {
      dragging = false;
    });

    // 滚轮缩放
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      cb.onZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });

    // 键盘
    window.addEventListener('keydown', function (e) {
      if (e.key === ' ') e.preventDefault(); // 阻止空格滚动页面
      cb.onKey(e.key);
    });
  }

  return { init: init };
})();