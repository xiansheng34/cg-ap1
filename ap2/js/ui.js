// js/ui.js —— 右侧参数面板
// 只做三件事：读控件、写回显、把变化通过回调抛给主程序。
// 不持有场景状态，因此键盘 / 鼠标等其它入口改变状态后，可调用 sync* 主动回写 UI。

window.UI = (function () {
  'use strict';

  var cb = {};
  var els = {};

  function $(id) { return document.getElementById(id); }

  function bindRange(inputId, valueId, digits, onChange) {
    var input = $(inputId);
    var label = $(valueId);
    input.addEventListener('input', function () {
      var v = Number(input.value);
      label.textContent = v.toFixed(digits);
      onChange(v);
    });
    els[inputId] = input;
    els[valueId] = label;
  }

  function init(callbacks) {
    cb = callbacks || {};

    bindRange('orbitSpeed', 'orbitSpeedVal', 1, function (v) { cb.onOrbitSpeed(v); });
    bindRange('spinSpeed', 'spinSpeedVal', 1, function (v) { cb.onSpinSpeed(v); });
    bindRange('earthTilt', 'earthTiltVal', 1, function (v) { cb.onEarthTilt(v); });
    bindRange('moonInclination', 'moonInclinationVal', 1, function (v) { cb.onMoonInclination(v); });

    els.showOrbits = $('showOrbits');
    els.showOrbits.addEventListener('change', function () {
      cb.onShowOrbits(els.showOrbits.checked);
    });

    els.showBelt = $('showBelt');
    els.showBelt.addEventListener('change', function () {
      cb.onShowBelt(els.showBelt.checked);
    });

    els.tourBtn = $('tourBtn');
    els.tourBtn.addEventListener('click', function () { cb.onTourButton(); });

    els.projBtn = $('projBtn');
    els.projBtn.addEventListener('click', function () { cb.onProjectionButton(); });

    els.projState = $('projState');
  }

  // 漫游按钮文案：三个状态（漫游中 / 已暂停 / 已被鼠标接管）
  function syncTour(enabled, paused) {
    if (!enabled) els.tourBtn.textContent = '开启漫游';
    else els.tourBtn.textContent = paused ? '继续漫游' : '暂停漫游';
  }

  function syncProjection(mode) {
    els.projState.textContent = (mode === 'persp') ? '透视' : '正交';
  }

  return {
    init: init,
    syncTour: syncTour,
    syncProjection: syncProjection
  };
})();
