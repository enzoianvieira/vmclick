/* ==========================================================================
   VM Click - cena 3D do hero (three.js)
   Malha de trilhas de circuito com pulsos de energia percorrendo os caminhos.
   Referência visual direta ao ramo da empresa: condução de energia.

   Degrada com elegância: sem WebGL, sem three.js ou com "prefers-reduced-motion"
   ativo, o hero fica apenas com o gradiente - nada quebra.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;

  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var THREE = window.THREE;
  var renderer, scene, camera, grupo, relogio;
  var trilhas = [];
  var pulsos = { geo: null, pontos: null, dados: [] };
  var mouse = { x: 0, y: 0, ax: 0, ay: 0 };
  var largura = 0, altura = 0, aspecto = 1;
  var rodando = false;

  var COR_TRILHA = new THREE.Color('#0C5C53');
  var COR_NO     = new THREE.Color('#1E8F81');
  var COR_PULSO  = new THREE.Color('#7FD3C7');
  var COR_PULSO2 = new THREE.Color('#E63337');

  var PASSO = 0.12;   /* espaçamento da grade, em unidades de mundo */

  /* ======================================================================
     Geração das trilhas: caminhos ortogonais da esquerda para a direita,
     como as pistas de uma placa de circuito.
     ====================================================================== */
  function gerarTrilha(yInicial) {
    var pts = [];
    var x = -aspecto - PASSO;
    var y = yInicial;
    pts.push(new THREE.Vector3(x, y, 0));

    var limite = aspecto + PASSO;
    var guarda = 0;

    while (x < limite && guarda++ < 60) {
      /* segmento horizontal */
      var passosH = 1 + Math.floor(Math.random() * 5);
      x = Math.min(limite, x + passosH * PASSO);
      pts.push(new THREE.Vector3(x, y, 0));

      if (x >= limite) break;

      /* degrau vertical */
      var dir = Math.random() > 0.5 ? 1 : -1;
      var passosV = 1 + Math.floor(Math.random() * 3);
      var novoY = y + dir * passosV * PASSO;
      if (Math.abs(novoY) > 1.02) novoY = y - dir * passosV * PASSO;
      y = novoY;
      pts.push(new THREE.Vector3(x, y, 0));
    }

    /* comprimentos acumulados, para deslocar os pulsos com velocidade constante */
    var acum = [0];
    for (var i = 1; i < pts.length; i++) {
      acum.push(acum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    }
    return { pts: pts, acum: acum, total: acum[acum.length - 1] };
  }

  function pontoEm(trilha, dist) {
    var acum = trilha.acum;
    if (dist <= 0) return trilha.pts[0];
    if (dist >= trilha.total) return trilha.pts[trilha.pts.length - 1];
    var i = 1;
    while (i < acum.length && acum[i] < dist) i++;
    var t = (dist - acum[i - 1]) / (acum[i] - acum[i - 1] || 1);
    return trilha.pts[i - 1].clone().lerp(trilha.pts[i], t);
  }

  /* ======================================================================
     Montagem da cena
     ====================================================================== */
  function textureCirculo() {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    var tex = new THREE.Texture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function construir() {
    var qtd = largura < 700 ? 12 : (largura < 1200 ? 18 : 26);
    trilhas = [];
    var linhaPts = [];
    var linhaCor = [];
    var noPts = [];

    for (var i = 0; i < qtd; i++) {
      var y = -1 + (2 / qtd) * (i + 0.5) + (Math.random() - 0.5) * PASSO;
      var t = gerarTrilha(Math.round(y / PASSO) * PASSO);
      trilhas.push(t);

      for (var j = 1; j < t.pts.length; j++) {
        var a = t.pts[j - 1], b = t.pts[j];
        linhaPts.push(a.x, a.y, 0, b.x, b.y, 0);
        /* trilhas do meio ficam levemente mais fortes */
        var f = 0.55 + 0.45 * (1 - Math.abs(a.y));
        linhaCor.push(
          COR_TRILHA.r * f, COR_TRILHA.g * f, COR_TRILHA.b * f,
          COR_TRILHA.r * f, COR_TRILHA.g * f, COR_TRILHA.b * f
        );
        noPts.push(b.x, b.y, 0);
      }
    }

    /* trilhas */
    var geoL = new THREE.BufferGeometry();
    geoL.setAttribute('position', new THREE.Float32BufferAttribute(linhaPts, 3));
    geoL.setAttribute('color', new THREE.Float32BufferAttribute(linhaCor, 3));
    grupo.add(new THREE.LineSegments(geoL, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.9
    })));

    /* nós (vértices das trilhas) */
    var geoN = new THREE.BufferGeometry();
    geoN.setAttribute('position', new THREE.Float32BufferAttribute(noPts, 3));
    grupo.add(new THREE.Points(geoN, new THREE.PointsMaterial({
      color: COR_NO, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.55
    })));

    /* pulsos de energia */
    var posP = [];
    var corP = [];
    pulsos.dados = [];

    trilhas.forEach(function (t, idx) {
      var n = 1 + (idx % 3 === 0 ? 1 : 0);
      for (var k = 0; k < n; k++) {
        var vermelho = Math.random() < 0.12;
        pulsos.dados.push({
          t: t,
          d: Math.random() * t.total,
          v: 0.16 + Math.random() * 0.26,
          c: vermelho ? COR_PULSO2 : COR_PULSO
        });
        posP.push(0, 0, 0);
        var c = vermelho ? COR_PULSO2 : COR_PULSO;
        corP.push(c.r, c.g, c.b);
      }
    });

    var geoP = new THREE.BufferGeometry();
    geoP.setAttribute('position', new THREE.Float32BufferAttribute(posP, 3));
    geoP.setAttribute('color', new THREE.Float32BufferAttribute(corP, 3));
    pulsos.geo = geoP;
    pulsos.pontos = new THREE.Points(geoP, new THREE.PointsMaterial({
      size: 22, sizeAttenuation: false, vertexColors: true,
      map: textureCirculo(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.95
    }));
    grupo.add(pulsos.pontos);
  }

  function limpar() {
    while (grupo.children.length) {
      var o = grupo.children.pop();
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    }
  }

  /* ======================================================================
     Ciclo de vida
     ====================================================================== */
  function dimensionar() {
    var r = canvas.getBoundingClientRect();
    largura = Math.max(1, r.width);
    altura = Math.max(1, r.height);
    aspecto = largura / altura;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(largura, altura, false);

    camera.left = -aspecto; camera.right = aspecto;
    camera.top = 1; camera.bottom = -1;
    camera.updateProjectionMatrix();
  }

  function animar() {
    if (!rodando) return;
    requestAnimationFrame(animar);

    var dt = Math.min(relogio.getDelta(), 0.05);
    var pos = pulsos.geo.attributes.position;

    for (var i = 0; i < pulsos.dados.length; i++) {
      var p = pulsos.dados[i];
      p.d += p.v * dt;
      if (p.d > p.t.total) p.d = 0;
      var v = pontoEm(p.t, p.d);
      pos.setXYZ(i, v.x, v.y, 0);
    }
    pos.needsUpdate = true;

    /* paralaxe suave seguindo o mouse */
    mouse.ax += (mouse.x - mouse.ax) * 0.045;
    mouse.ay += (mouse.y - mouse.ay) * 0.045;
    grupo.position.x = mouse.ax * 0.06;
    grupo.position.y = -mouse.ay * 0.04;
    grupo.rotation.z = mouse.ax * 0.012;

    renderer.render(scene, camera);
  }

  function iniciar() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { return; }

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    camera.position.z = 2;
    grupo = new THREE.Group();
    scene.add(grupo);
    relogio = new THREE.Clock();

    dimensionar();
    construir();
    renderer.render(scene, camera);
    canvas.classList.add('is-ready');

    if (reduzido) return;   /* cena estática, sem loop */

    rodando = true;
    animar();

    window.addEventListener('mousemove', function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        dimensionar();
        limpar();
        construir();
      }, 220);
    });

    /* pausa quando o hero sai da tela - não gasta GPU à toa */
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entradas) {
        var visivel = entradas[0].isIntersecting;
        if (visivel && !rodando) { rodando = true; relogio.getDelta(); animar(); }
        else if (!visivel) { rodando = false; }
      }, { threshold: 0.01 }).observe(canvas);
    }
  }

  iniciar();
})();

