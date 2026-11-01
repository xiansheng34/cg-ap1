// js/input.js —— 鼠标 / 键盘输入
//
// 鼠标坐标统一转成 NDC（x,y ∈ [-1,1]，y 向上）后回调，
// 由 camera.js 负责"NDC → 轨迹球"的映射，输入层不掺几何逻辑。
// 使用 Pointer Events 同时兼容鼠标与触控板拖拽。

window.Input = (function () {
  'use strict';

  function init(canvas, callbacks) {
    var dragging = false;
    var lastX = 0, lastY = 0;
    var lastNX = 0, lastNY = 0;

    function toNDC(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      return [
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1)
      ];
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      var n = toNDC(lastX, lastY);
      lastNX = n[0];
      lastNY = n[1];
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var n = toNDC(e.clientX, e.clientY);
      callbacks.onDrag(lastNX, lastNY, n[0], n[1]);
      lastNX = n[0];
      lastNY = n[1];
      lastX = e.clientX;
      lastY = e.clientY;
    });

    function stopDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    }
    canvas.addEventListener('pointerup', stopDrag);
    canvas.addEventListener('pointercancel', stopDrag);

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      callbacks.onZoom(e.deltaY < 0 ? 0.9 : 1 / 0.9);
    }, { passive: false });

    window.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') e.preventDefault();  // 防止空格滚动页面
      callbacks.onKey(e.key);
    });
  }

  return { init: init };
})();
