// geometry.js —— 几何生成模块
// 负责两种算法的顶点数据组织：混沌游戏（点）与递归细分（三角形 / 线框）。

window.Geometry = (function () {
  'use strict';

  // 等边三角形三个顶点（质心在原点），用于两种算法
  var SQRT3 = Math.sqrt(3);
  var VERTICES = [
    { x: 0.0,        y: 1.0 },      // 顶
    { x: -SQRT3 / 2, y: -0.5 },     // 左下
    { x: SQRT3 / 2,  y: -0.5 }      // 右下
  ];

  function mid(p, q) {
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }

  // 混沌游戏：初始点随机，反复 p = (p + 随机顶点) / 2，生成 n 个点
  function chaosGame(n) {
    var pts = new Float32Array(n * 2);
    var p = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    for (var i = 0; i < n; i++) {
      var v = VERTICES[(Math.random() * 3) | 0];
      p = mid(p, v);
      pts[i * 2] = p.x;
      pts[i * 2 + 1] = p.y;
    }
    return pts;
  }

  // 递归细分：从单个三角形开始，每层把每个三角形拆成三个子三角形，共 3^depth 个
  function subdivide(depth) {
    var tris = [{ a: VERTICES[0], b: VERTICES[1], c: VERTICES[2] }];
    for (var d = 0; d < depth; d++) {
      var next = [];
      for (var i = 0; i < tris.length; i++) {
        var t = tris[i];
        var ab = mid(t.a, t.b);
        var bc = mid(t.b, t.c);
        var ca = mid(t.c, t.a);
        next.push({ a: t.a, b: ab, c: ca });
        next.push({ a: ab, b: t.b, c: bc });
        next.push({ a: ca, b: bc, c: t.c });
      }
      tris = next;
    }
    return tris;
  }

  // 三角形列表 → 实体顶点数组（TRIANGLES，每三角形 3 个顶点）
  function trianglesToVertexArray(tris) {
    var arr = new Float32Array(tris.length * 6);
    var i = 0;
    for (var k = 0; k < tris.length; k++) {
      var t = tris[k];
      arr[i++] = t.a.x; arr[i++] = t.a.y;
      arr[i++] = t.b.x; arr[i++] = t.b.y;
      arr[i++] = t.c.x; arr[i++] = t.c.y;
    }
    return arr;
  }

  // 三角形列表 → 去重后的边数组（LINES，每条边 2 个端点）
  function trianglesToEdges(tris) {
    var seen = new Set();
    var edges = [];

    function addEdge(p, q) {
      // 对端点做定点化 + 排序，保证共边只保留一条
      function f(x) { return Math.round(x * 1e6); }
      var p1 = f(p.x), p2 = f(p.y), q1 = f(q.x), q2 = f(q.y);
      if (p1 > q1 || (p1 === q1 && p2 > q2)) {
        var t1 = p1, t2 = p2; p1 = q1; p2 = q2; q1 = t1; q2 = t2;
      }
      var key = p1 + ',' + p2 + ',' + q1 + ',' + q2;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push(p.x, p.y, q.x, q.y);
      }
    }

    for (var k = 0; k < tris.length; k++) {
      var t = tris[k];
      addEdge(t.a, t.b);
      addEdge(t.b, t.c);
      addEdge(t.c, t.a);
    }
    return new Float32Array(edges);
  }

  return {
    VERTICES: VERTICES,
    chaosGame: chaosGame,
    subdivide: subdivide,
    trianglesToVertexArray: trianglesToVertexArray,
    trianglesToEdges: trianglesToEdges
  };
})();