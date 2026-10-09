// ui.js —— 参数面板模块
// 绑定 HTML 原生控件（range/select/radio），读取当前值，并通过回调通知主程序。

window.UI = (function () {
  'use strict';

  var cb = {};
  var els = {};

  function $(id) { return document.getElementById(id); }

  function init(callbacks) {
    cb = callbacks;

    els.pointCount = $('pointCount');
    els.pointCountVal = $('pointCountVal');
    els.depth = $('depth');
    els.depthVal = $('depthVal');
    els.pointSize = $('pointSize');
    els.pointSizeVal = $('pointSizeVal');
    els.colorScheme = $('colorScheme');
    els.modeRadios = Array.prototype.slice.call(document.querySelectorAll('input[name="renderMode"]'));

    // 顶点数（点云模式）
    els.pointCount.addEventListener('input', function () {
      els.pointCountVal.textContent = els.pointCount.value;
      cb.onPointCount(Number(els.pointCount.value));
    });

    // 递归深度（线框 / 实体模式）
    els.depth.addEventListener('input', function () {
      els.depthVal.textContent = els.depth.value;
      cb.onDepth(Number(els.depth.value));
    });

    // 点大小
    els.pointSize.addEventListener('input', function () {
      els.pointSizeVal.textContent = els.pointSize.value;
      cb.onPointSize(Number(els.pointSize.value));
    });

    // 配色方案
    els.colorScheme.addEventListener('change', function () {
      cb.onColorScheme(Number(els.colorScheme.value));
    });

    // 渲染模式
    els.modeRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (r.checked) cb.onMode(r.value);
      });
    });

    // 初始同步滑块启用/禁用状态
    syncMode(getMode());
  }

  // 读取当前选中的渲染模式
  function getMode() {
    var radios = document.querySelectorAll('input[name="renderMode"]');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) return radios[i].value;
    }
    return 'points';
  }

  // 根据渲染模式启用/禁用对应控件：
  // 点云模式 → 顶点数、点大小有效；线框/实体 → 递归深度有效
  function syncMode(mode) {
    var isPoints = (mode === 'points');
    els.pointCount.disabled = !isPoints;
    els.pointSize.disabled = !isPoints;
    els.depth.disabled = isPoints;
  }

  return { init: init, getMode: getMode, syncMode: syncMode };
})();