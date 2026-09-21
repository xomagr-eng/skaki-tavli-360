/* ΣΚΑΚΙ & ΤΑΒΛΙ 360° — pieces.js
   Ρεαλιστικά πιόνια σκακιού σε SVG (στιλ Staunton), με βαθμίδα για 3D γυαλιστερή όψη.
   Χρώμα μέσω CSS μεταβλητών (--pc-hi/-mid/-lo/-line) ώστε να δουλεύουν τα θέματα. */
(function (global) {
  "use strict";

  const SHAPES = {
    p: `
      <ellipse cx="50" cy="90" rx="22" ry="5.5"/>
      <path d="M35 90 L39 71 Q50 77 61 71 L65 90 Z"/>
      <path d="M42 55 L40 71 Q50 75 60 71 L58 55 Z"/>
      <ellipse cx="50" cy="53" rx="12.5" ry="4"/>
      <circle cx="50" cy="35" r="13.5"/>`,
    r: `
      <ellipse cx="50" cy="90" rx="24" ry="6"/>
      <path d="M32 90 L36 72 Q50 78 64 72 L68 90 Z"/>
      <path d="M37 51 L35 70 Q50 75 65 70 L63 51 Z"/>
      <rect x="32" y="45" width="36" height="7" rx="2"/>
      <path d="M32 45 L32 26 H40 V33 H46 V26 H54 V33 H60 V26 H68 V45 Z"/>`,
    b: `
      <ellipse cx="50" cy="90" rx="21" ry="5.5"/>
      <path d="M35 90 L39 72 Q50 78 61 72 L65 90 Z"/>
      <path d="M42 51 L40 70 Q50 75 60 70 L58 51 Z"/>
      <ellipse cx="50" cy="50" rx="12.5" ry="4"/>
      <path d="M50 16 Q61 29 58 41 Q54 48 50 49 Q46 48 42 41 Q39 29 50 16 Z"/>
      <circle cx="50" cy="14" r="4.5"/>`,
    n: `
      <ellipse cx="50" cy="90" rx="23" ry="6"/>
      <path d="M32 90 L36 73 Q50 79 64 73 L68 90 Z"/>
      <path d="M40 88 L38 66 C36 55 40 50 48 47 C43 44 39 42 39 35
               C39 27 46 20 58 21 L53 12 L64 17 C72 21 77 32 75 45
               C73 56 66 61 61 65 C59 73 60 81 62 88 Z"/>`,
    q: `
      <ellipse cx="50" cy="90" rx="23" ry="6"/>
      <path d="M33 90 L37 72 Q50 78 63 72 L67 90 Z"/>
      <path d="M39 51 L36 70 Q50 76 64 70 L61 51 Z"/>
      <ellipse cx="50" cy="50" rx="14.5" ry="4.5"/>
      <path d="M35 48 L30 25 L40 35 L45 21 L50 33 L55 21 L60 35 L70 25 L65 48 Z"/>
      <circle cx="30" cy="25" r="4"/><circle cx="45" cy="20" r="4"/>
      <circle cx="50" cy="31" r="4"/><circle cx="55" cy="20" r="4"/><circle cx="70" cy="25" r="4"/>`,
    k: `
      <ellipse cx="50" cy="90" rx="23" ry="6"/>
      <path d="M33 90 L37 72 Q50 78 63 72 L67 90 Z"/>
      <path d="M39 51 L36 70 Q50 76 64 70 L61 51 Z"/>
      <ellipse cx="50" cy="50" rx="14.5" ry="4.5"/>
      <path d="M35 48 Q33 31 50 31 Q67 31 65 48 Z"/>
      <rect x="46" y="9" width="8" height="21" rx="1.5"/>
      <rect x="40" y="15" width="20" height="8" rx="1.5"/>`,
  };
  // Λεπτομέρειες (μάτι/σχισμή) σε χρώμα περιγράμματος
  const DETAIL = {
    b: `<path d="M50 30 L56 38" fill="none" stroke="var(--pc-line)" stroke-width="2" stroke-linecap="round"/>`,
    n: `<circle cx="57" cy="33" r="2.6" fill="var(--pc-line)" stroke="none"/>
        <path d="M52 15 C58 23 60 40 57 55" fill="none" stroke="var(--pc-line)" stroke-width="2" stroke-linecap="round"/>`,
  };

  function pieceSVG(type, color) {
    const gid = "pg-" + color, sid = "ps-" + color;
    return `<svg class="cp" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--pc-hi)"/>
          <stop offset="0.5" stop-color="var(--pc-mid)"/>
          <stop offset="1" stop-color="var(--pc-lo)"/>
        </linearGradient>
        <radialGradient id="${sid}" cx="0.36" cy="0.26" r="0.55">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
          <stop offset="0.6" stop-color="#ffffff" stop-opacity="0.08"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g fill="url(#${gid})" stroke="var(--pc-line)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
        ${SHAPES[type]}
      </g>
      <g fill="url(#${sid})" stroke="none">
        ${SHAPES[type]}
      </g>
      ${DETAIL[type] || ""}
    </svg>`;
  }

  global.PIECES = { svg: pieceSVG };
})(window);
