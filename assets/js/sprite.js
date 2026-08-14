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

<!-- MARCAS DE TERCEIROS
     Contorno oficial, sólido, não redesenhado à mão. O viewBox é maior que o
     glifo (que ocupa 448x448) só para dar a mesma margem óptica dos outros
     ícones - por isso a origem negativa em x. -->
<symbol id="m-whatsapp" viewBox="-32 0 512 512" fill="currentColor" stroke="none">
  <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94.2-25.7l-6.7-4-71.4 18.8L70 356.6l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-34.5-17-49.8-24.5-4.7-2.1-8.1-3.1-11.5 2.1-3.4 5.2-12.9 16.3-16.2 19.7-3.4 3.4-6.8 3.9-12.3 1.1-5.5-2.8-24.5-9-46.7-28.7-17.6-15.7-25.4-27.9-28.2-33.4-2.8-5.5-.3-8.5 2.5-11.3 2.8-2.8 8.1-8.5 12.1-13.3 4-4.8 4.9-8.3 7.4-13.8 2.5-5.5 1.2-10.3-.6-14.2-1.8-3.9-16.4-39.5-22.5-54.1-5.9-14.2-11.9-12.3-16.3-12.5-4.2-.2-9-.2-13.8-.2-4.8 0-12.6 1.8-19.2 9-6.6 7.2-25.1 24.5-25.1 60.1s25.7 70 29.3 74.8c3.6 4.8 50.6 77.3 122.6 108.4 17.1 7.4 30.5 11.8 40.9 15.1 15.7 5 29.2 4.3 40.2 2.6 12.3-1.8 45.3-18.5 51.7-36.4 6.4-17.9 6.4-33.2 4.5-36.4-1.9-3.2-6.9-5.1-12.4-7.9z"/>
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

