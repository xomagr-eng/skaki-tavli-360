/* ΣΚΑΚΙ & ΤΑΒΛΙ 360° — sfx.js
   Συνθετικοί ήχοι μέσω Web Audio API (χωρίς εξωτερικά αρχεία, 100% offline).
   Ζάρια που «κροταλίζουν» & πέφτουν, τοποθέτηση πουλιού, κίνηση/αιχμαλωσία σκακιού. */
(function (global) {
  "use strict";
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem("skakitavli_muted") === "1"; } catch (e) {}

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Σύντομος κρότος «ξύλου/ζαριού»: θόρυβος + ταχεία απόσβεση + bandpass
  function clack(t, { freq = 2200, dur = 0.05, gain = 0.5, q = 1.2 } = {}) {
    const c = ac(); if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2); }
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + dur);
  }

  // Χαμηλό «μπαμ» για την προσγείωση στο ξύλο
  function thud(t, { freq = 150, dur = 0.12, gain = 0.35 } = {}) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur);
  }

  const SFX = {
    get muted() { return muted; },
    setMuted(v) { muted = !!v; try { localStorage.setItem("skakitavli_muted", muted ? "1" : "0"); } catch (e) {} },
    unlock() { ac(); },

    // Ζαριά: κροτάλισμα καθώς «χοροπηδάνε» + δύο δυνατά χτυπήματα στην προσγείωση
    dice() {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t0 = c.currentTime;
      // κροτάλισμα (rattle)
      const bounces = 7;
      for (let i = 0; i < bounces; i++) {
        const t = t0 + i * 0.06 + Math.random() * 0.02;
        clack(t, { freq: 1600 + Math.random() * 1400, dur: 0.035, gain: 0.18 + Math.random() * 0.12, q: 1.5 });
      }
      // προσγείωση δύο ζαριών
      const land = t0 + bounces * 0.06 + 0.05;
      clack(land, { freq: 2400, dur: 0.06, gain: 0.5 }); thud(land, { gain: 0.3 });
      clack(land + 0.09, { freq: 2000, dur: 0.06, gain: 0.45 }); thud(land + 0.09, { gain: 0.28 });
    },

    // Τοποθέτηση πουλιού τάβλι — «κούμπωμα» στο δαχτυλίδι (τραγανό διπλό κλικ)
    place() {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      thud(t, { freq: 240, gain: 0.2, dur: 0.07 });
      clack(t, { freq: 1500, dur: 0.045, gain: 0.42, q: 1.1 });
      clack(t + 0.045, { freq: 2600, dur: 0.03, gain: 0.3, q: 2 }); // «κλικ» κουμπώματος
    },

    // Κίνηση κομματιού σκακιού
    move() {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      clack(t, { freq: 900, dur: 0.05, gain: 0.32, q: 0.8 }); thud(t, { freq: 180, gain: 0.16, dur: 0.07 });
    },
    // Αιχμαλωσία (πιο δυνατό)
    capture() {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      clack(t, { freq: 1200, dur: 0.05, gain: 0.4 });
      clack(t + 0.04, { freq: 700, dur: 0.06, gain: 0.35 }); thud(t + 0.02, { freq: 160, gain: 0.22, dur: 0.1 });
    },
  };

  // Ξεκλείδωμα AudioContext στο πρώτο user gesture
  ["pointerdown", "keydown", "touchstart"].forEach(ev =>
    window.addEventListener(ev, () => SFX.unlock(), { once: true, passive: true }));

  global.SFX = SFX;
})(window);
