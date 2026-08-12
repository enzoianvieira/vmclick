/* ==========================================================================
   VM Click - sprite de ilustrações técnicas de produto
   Injetado inline no boot para funcionar também em file:// (o cliente pode
   abrir o demo com duplo clique, sem servidor). Cada símbolo usa atributos de
   apresentação, não CSS - assim o <use> renderiza igual em qualquer contexto.
   Uso: <svg class="ico"><use href="#p-lampada"></use></svg>
   ========================================================================== */
(function () {
  var SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">

<!-- ILUMINAÇÃO -->
<symbol id="p-lampada" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M32 8a15 15 0 0 1 9 27v5H23v-5a15 15 0 0 1 9-27Z"/>
  <path d="M23 44h18M24 49h16"/>
  <path d="M27 53h10v2a5 5 0 0 1-10 0Z"/>
  <path d="M27 30l3-8 2 6 2-6 3 8" stroke-width="1.25" opacity=".55"/>
</symbol>
<symbol id="p-luminaria" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="8" y="16" width="48" height="20" rx="3"/>
  <path d="M8 30h48" stroke-width="1.25" opacity=".55"/>
  <path d="M32 16V9M18 42l-3 8M32 42v9M46 42l3 8"/>
  <path d="M14 22h6M44 22h6" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>
<symbol id="p-refletor" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 14h28l6 22H12l6-22Z"/>
  <path d="M16 28h32" stroke-width="1.25" opacity=".55"/>
  <path d="M32 36v10M22 52h20M26 46h12v6"/>
  <path d="M10 12 6 8M54 12l4-4" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>
<symbol id="p-fita-led" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="6" y="26" width="52" height="12" rx="3"/>
  <circle cx="17" cy="32" r="2.2" fill="currentColor" stroke="none"/>
  <circle cx="27" cy="32" r="2.2" fill="currentColor" stroke="none"/>
  <circle cx="37" cy="32" r="2.2" fill="currentColor" stroke="none"/>
  <circle cx="47" cy="32" r="2.2" fill="currentColor" stroke="none"/>
  <path d="M6 42h52M6 22h52" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>
<symbol id="p-sensor" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 40a12 12 0 0 1 24 0Z"/>
  <path d="M16 40h32M28 46h8v6h-8z"/>
  <path d="M24 26a12 12 0 0 1 16 0M18 18a22 22 0 0 1 28 0" stroke-width="1.25" opacity=".55"/>
</symbol>

<!-- ELÉTRICA -->
<symbol id="p-disjuntor" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="20" y="12" width="24" height="40" rx="2"/>
  <path d="M20 22h-6M20 42h-6M44 22h6M44 42h6"/>
  <rect x="27" y="20" width="10" height="12" rx="1.5"/>
  <path d="M27 38h10M27 44h10" stroke-width="1.25" opacity=".55"/>
  <path d="M32 12V6" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>
<symbol id="p-cabo" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="29" cy="33" r="19"/>
  <circle cx="29" cy="33" r="8"/>
  <path d="M29 14a19 19 0 0 1 0 38" stroke-width="1.25" opacity=".55"/>
  <path d="M45 21l11-7M50 18l5 6"/>
</symbol>
<symbol id="p-tomada" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="12" y="12" width="40" height="40" rx="6"/>
  <circle cx="32" cy="32" r="13"/>
  <circle cx="26" cy="30" r="2.4" fill="currentColor" stroke="none"/>
  <circle cx="38" cy="30" r="2.4" fill="currentColor" stroke="none"/>
  <circle cx="32" cy="39" r="2.4" fill="currentColor" stroke="none"/>
  <path d="M12 22H7M57 22h-5" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>
<symbol id="p-interruptor" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="14" y="10" width="36" height="44" rx="5"/>
  <rect x="23" y="20" width="18" height="24" rx="2"/>
  <path d="M23 32h18" stroke-width="1.25" opacity=".55"/>
  <circle cx="32" cy="16" r="1.4" fill="currentColor" stroke="none"/>
</symbol>
<symbol id="p-quadro" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="10" width="44" height="44" rx="4"/>
  <path d="M10 22h44"/>
  <rect x="17" y="29" width="6" height="14" rx="1"/>
  <rect x="26" y="29" width="6" height="14" rx="1"/>
  <rect x="35" y="29" width="6" height="14" rx="1"/>
  <rect x="44" y="29" width="3" height="14" rx="1" stroke-width="1.25" opacity=".55"/>
  <path d="M16 16h12" stroke-width="1.25" opacity=".55"/>
</symbol>
<symbol id="p-eletroduto" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 24h48v16H8z"/>
  <path d="M18 24v16M26 24v16M34 24v16M42 24v16M50 24v16" stroke-width="1.25" opacity=".55"/>
  <path d="M8 18h48" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>

<!-- HIDRÁULICA -->
<symbol id="p-tubo" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 22h36M14 42h36"/>
  <ellipse cx="14" cy="32" rx="6" ry="10"/>
  <ellipse cx="50" cy="32" rx="6" ry="10" stroke-width="1.25" opacity=".55"/>
  <path d="M8 54h48" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
  <path d="M8 51v6M56 51v6" stroke-width="1.25" opacity=".55"/>
</symbol>
<symbol id="p-joelho" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 18h12a20 20 0 0 1 20 20v6"/>
  <path d="M16 34h12a6 6 0 0 1 6 6v4"/>
  <path d="M10 14h6v24h-6z"/>
  <path d="M32 44h18v6H32z"/>
</symbol>
<symbol id="p-registro" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 28h12v12H8zM44 28h12v12H44z"/>
  <path d="M20 26h24v16H20z"/>
  <path d="M32 26V14M22 12h20"/>
  <circle cx="32" cy="34" r="5" stroke-width="1.25" opacity=".55"/>
</symbol>
<symbol id="p-torneira" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 44h16v8H14z"/>
  <path d="M22 44V28a10 10 0 0 1 10-10h10"/>
  <path d="M42 12h8v12h-8z"/>
  <path d="M46 24v6M42 30h8" stroke-width="1.25" opacity=".55"/>
  <path d="M22 52v6" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>
<symbol id="p-caixa-agua" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 22h32l-4 30H20L16 22Z"/>
  <path d="M14 16h36v6H14z"/>
  <path d="M18 34h28M20 44h24" stroke-width="1.25" opacity=".55"/>
</symbol>

<!-- PINTURA E CONSTRUÇÃO -->
<symbol id="p-tinta" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 20h32l-3 32H19L16 20Z"/>
  <path d="M16 20h32M20 14a12 6 0 0 1 24 0"/>
  <path d="M22 32h20" stroke-width="1.25" opacity=".55"/>
  <circle cx="51" cy="44" r="2.5" fill="currentColor" stroke="none"/>
</symbol>
<symbol id="p-rolo" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="12" y="14" width="32" height="14" rx="4"/>
  <path d="M44 21h6v8H30v6"/>
  <path d="M26 35h8v18h-8z"/>
  <path d="M20 14v14M28 14v14M36 14v14" stroke-width="1.25" opacity=".55"/>
</symbol>
<symbol id="p-massa" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 20h36l-4 32H18L14 20Z"/>
  <path d="M12 14h40v6H12z"/>
  <path d="M22 28c6 4 14 4 20 0" stroke-width="1.25" opacity=".55"/>
  <path d="M32 34v12" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>

<!-- UTILIDADES -->
<symbol id="p-alicate" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 8l10 20 10-20"/>
  <path d="M24 36c-4 6-6 12-6 20M40 36c4 6 6 12 6 20"/>
  <circle cx="32" cy="32" r="4"/>
</symbol>
<symbol id="p-chave-fenda" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M26 8h12v18H26z"/>
  <path d="M26 14h12M26 20h12" stroke-width="1.25" opacity=".55"/>
  <path d="M29 26h6v22l-3 6-3-6V26Z"/>
</symbol>
<symbol id="p-trena" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="18" width="32" height="28" rx="5"/>
  <circle cx="26" cy="32" r="8"/>
  <path d="M42 26h14v10H42"/>
  <path d="M46 26v5M50 26v7M54 26v5" stroke-width="1.25" opacity=".55"/>
</symbol>
<symbol id="p-epi" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 40a18 18 0 0 1 36 0Z"/>
  <path d="M10 40h44"/>
  <path d="M32 22v-6M26 24a10 10 0 0 1 12 0" stroke-width="1.25" opacity=".55"/>
  <path d="M20 46h24" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>
<symbol id="p-projeto" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="12" width="44" height="40" rx="3"/>
  <path d="M10 20h44M18 12v8" stroke-width="1.25" opacity=".55"/>
  <path d="M20 42V30h10v12M30 34h12v8"/>
  <path d="M16 46h32" stroke-width="1.25" opacity=".45" stroke-dasharray="3 3"/>
</symbol>
</svg>`;

  function inject() {
    var host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    host.innerHTML = SPRITE;
    document.body.insertBefore(host, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

