/* ΣΚΑΚΙ & ΤΑΒΛΙ 360° — tavli.js
   Ταμπλό τάβλι: ρεαλιστικό render + ζάρια (πτώση+ήχος) + διαδραστική εξάσκηση
   + AI αντίπαλος. Παραλλαγές: Πόρτες / Πλακωτό / Φεύγα. */
(function (global) {
  "use strict";

  const PATHS = {
    portes: {
      w: [23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
      b: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    },
    plakoto: {
      w: [23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
      b: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    },
    fevga: {
      w: [23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
      b: [11,10,9,8,7,6,5,4,3,2,1,0,23,22,21,20,19,18,17,16,15,14,13,12],
    },
    asodyo: {
      w: [23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
      b: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    },
    // Τάπα & Μαχμπούσι: όπως Πλακωτό/Πόρτες (αντίθετες φορές)
    tapa: {
      w: [23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
      b: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    },
    mahbusa: {
      w: [23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
      b: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    },
    // Γκιούλμπαρα & Ταμπλά: ίδια φορά (όπως Φεύγα)
    gulbara: {
      w: [23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
      b: [11,10,9,8,7,6,5,4,3,2,1,0,23,22,21,20,19,18,17,16,15,14,13,12],
    },
    tabula: {
      w: [23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
      b: [11,10,9,8,7,6,5,4,3,2,1,0,23,22,21,20,19,18,17,16,15,14,13,12],
    },
  };
  const STARTS = {
    portes: () => { const p = empty(); p[23].w=2; p[12].w=5; p[7].w=3; p[5].w=5; p[0].b=2; p[11].b=5; p[16].b=3; p[18].b=5; return p; },
    plakoto: () => { const p = empty(); p[23].w=15; p[0].b=15; return p; },
    fevga: () => { const p = empty(); p[23].w=15; p[11].b=15; return p; },
    asodyo: () => empty(), // όλα τα πούλια ξεκινούν έξω (στη μπάρα)
    tapa: () => { const p = empty(); p[23].w=15; p[0].b=15; return p; },
    mahbusa: () => { const p = empty(); p[23].w=2; p[12].w=5; p[7].w=3; p[5].w=5; p[0].b=2; p[11].b=5; p[16].b=3; p[18].b=5; return p; },
    gulbara: () => { const p = empty(); p[23].w=15; p[11].b=15; return p; },
    tabula: () => empty(), // όλα τα πούλια ξεκινούν έξω (στη μπάρα)
  };
  const BARSTART = (v) => v === "asodyo" || v === "tabula";
  const PORTESLIKE = (v) => v === "portes" || v === "asodyo" || v === "tabula";   // χτύπημα
  const PLAKOTOLIKE = (v) => v === "plakoto" || v === "tapa" || v === "mahbusa";  // πλάκωμα
  const FEVGALIKE = (v) => v === "fevga" || v === "gulbara";                      // φράξιμο
  function empty() { return Array.from({ length: 24 }, () => ({ w: 0, b: 0 })); }
  function other(c) { return c === "w" ? "b" : "w"; }
  function newStats() { return { hits: 0, gotHit: 0, pins: 0, points: 0, blots: 0, pipsLost: 0 }; }

  const LAYOUT = { topLeft:[12,13,14,15,16,17], topRight:[18,19,20,21,22,23], botLeft:[11,10,9,8,7,6], botRight:[5,4,3,2,1,0] };

  function createTavli(container, opts) {
    opts = opts || {};
    let variant = opts.variant || "portes";
    let points, bar, off, pins, turn, dice, selected;
    let vsComputer = !!opts.vsComputer;
    let aiSide = opts.aiSide || "b";
    let aiLevel = opts.aiLevel || 2;   // 1=Εύκολος, 2=Μέτριος, 3=Δυνατός
    let aiBusy = false;
    let drag = null, lastDrop = 0, locked = false;
    let destSet = new Set(), bearSet = new Set(), movSet = new Set();
    let cubeValue = 1, cubeOwner = null, pendingDouble = null; // owner null=κέντρο
    let score = { w: 0, b: 0 }, target = opts.target || 7, matchOver = false;
    let movBar = false;
    let coachOn = !!opts.coach, coachHL = null;
    let stats = { w: newStats(), b: newStats() };
    let hasRolled = false;      // έχει ρίξει ζάρια σε αυτή τη σειρά;
    let aceyStage = null;       // null | 'need_double' | 'need_reroll' (Ασσόδυο 1-2)
    const onInfo = opts.onInfo || function () {};
    const onTurn = opts.onTurn || function () {};
    const onWin = opts.onWin || function () {};
    const onCube = opts.onCube || function () {};
    const onGameResult = opts.onGameResult || function () {};
    const onCoach = opts.onCoach || function () {};

    const boardWrap = document.createElement("div"); boardWrap.className = "bg-wrap";
    const boardEl = document.createElement("div"); boardEl.className = "bg-board";
    const diceTray = document.createElement("div"); diceTray.className = "dice-tray";
    const diceEl = document.createElement("div"); diceEl.className = "dice";
    boardWrap.appendChild(boardEl); boardWrap.appendChild(diceTray);
    container.innerHTML = ""; container.appendChild(boardWrap); container.appendChild(diceEl);

    function reset(v) {
      if (v) variant = v;
      points = STARTS[variant]();
      bar = BARSTART(variant) ? { w:15, b:15 } : { w:0, b:0 };
      off = { w:0, b:0 }; pins = {};
      turn = "w"; dice = []; selected = null; aiBusy = false; locked = false;
      hasRolled = false; aceyStage = null;
      cubeValue = 1; cubeOwner = null; pendingDouble = null;
      stats = { w: newStats(), b: newStats() };
      render(); renderDice();
      onTurn("w", null);
      info(`Παραλλαγή: ${variant.toUpperCase()}. Ρίξε ζάρια για να ξεκινήσεις. Σειρά: Λευκά.`);
      maybeAI();
    }
    function path(c) { return PATHS[variant][c]; }
    function allHome(c) {
      const pth = path(c); if (bar[c] > 0) return false;
      for (let k = 0; k < 18; k++) if (points[pth[k]][c] > 0) return false;
      return true;
    }

    // ---------- RENDER ----------
    function triClass(k) { return k % 2 === 0 ? "a" : "b"; }
    // Νόμιμοι προορισμοί για επιλεγμένη πηγή (highlight)
    function destsFor(from) {
      if (from == null || !dice.length) return [];
      const color = turn, pth = path(color), opp = other(color);
      const fromPos = from === "bar" ? -1 : pth.indexOf(from);
      const res = [];
      for (const d of [...new Set(dice)]) {
        const tp = fromPos + d;
        if (tp >= 24) continue;
        const toIdx = pth[tp], dest = points[toIdx];
        let ok = true;
        if (PORTESLIKE(variant)) { if (dest[opp] >= 2) ok = false; }
        else if (PLAKOTOLIKE(variant)) { if (pins[toIdx] && pins[toIdx] !== color) ok = dest[opp] < 2; else if (dest[opp] >= 2) ok = false; }
        else if (FEVGALIKE(variant)) { if (dest[opp] >= 1) ok = false; }
        if (ok) res.push(toIdx);
      }
      return res;
    }

    // Σημεία απ' όπου μπορείς να μαζέψεις τώρα (highlight bear-off)
    function bearsFor() {
      if (!allHome(turn) || !dice.length) return new Set();
      const pth = path(turn), s = new Set();
      for (let pos = 18; pos < 24; pos++) {
        const idx = pth[pos];
        if (points[idx][turn] <= 0) continue;
        const need = 24 - pos;
        if (dice.includes(need)) { s.add(idx); continue; }
        if (dice.some(d => d > need)) {
          let higher = false;
          for (let p2 = 18; p2 < pos; p2++) { if (points[pth[p2]][turn] > 0) { higher = true; break; } }
          if (!higher) s.add(idx);
        }
      }
      return s;
    }

    // Pip count: συνολικοί πόντοι που χρειάζεται ο παίκτης για να μαζέψει
    function pip(color) {
      const pth = path(color);
      let total = bar[color] * 25;
      for (let idx = 0; idx < 24; idx++) {
        let n = points[idx][color];
        if (pins[idx] === color) n += 1; // πλακωμένο δικό μας πούλι
        if (n > 0) total += n * (24 - pth.indexOf(idx));
      }
      return total;
    }

    // Πούλια που ΜΠΟΡΟΥΝ να κινηθούν με την τρέχουσα ζαριά (highlight όταν τίποτα επιλεγμένο)
    function movablePoints() {
      if (selected !== null || !dice.length) return { pts: new Set(), bar: false };
      if (bar[turn] > 0) return { pts: new Set(), bar: enumerateMoves(turn).length > 0 };
      const s = new Set();
      for (const m of enumerateMoves(turn)) if (typeof m.from === "number") s.add(m.from);
      for (const b of bearsFor()) s.delete(b); // τα bear σημεία έχουν ήδη πράσινο σημάδι
      return { pts: s, bar: false };
    }

    function render() {
      destSet = new Set(isHumanTurn() ? destsFor(selected) : []);
      bearSet = isHumanTurn() ? bearsFor() : new Set();
      const mv = isHumanTurn() ? movablePoints() : { pts: new Set(), bar: false };
      movSet = mv.pts; movBar = mv.bar;
      coachHL = null;
      if (coachOn && isHumanTurn() && dice.length && selected === null && !pendingDouble && !locked) {
        const s = suggestMove();
        if (s) { coachHL = s; movSet = new Set(); movBar = false; onCoach(s.reason); }
        else onCoach("Δεν υπάρχει διαθέσιμη κίνηση με αυτή τη ζαριά.");
      } else if (coachOn) { onCoach(""); }
      if (opts.onPips) opts.onPips(pip("w"), pip("b"), turn);
      boardEl.innerHTML = "";
      boardEl.appendChild(half(LAYOUT.topLeft, LAYOUT.botLeft));
      const barCol = document.createElement("div"); barCol.className = "bg-bar"; renderBar(barCol);
      boardEl.appendChild(barCol);
      boardEl.appendChild(half(LAYOUT.topRight, LAYOUT.botRight));
    }
    function half(topArr, botArr) {
      const h = document.createElement("div"); h.className = "bg-half";
      const top = document.createElement("div"); top.className = "bg-quad";
      const bot = document.createElement("div"); bot.className = "bg-quad";
      topArr.forEach((idx,k) => top.appendChild(point(idx,"top",k)));
      botArr.forEach((idx,k) => bot.appendChild(point(idx,"bot",k)));
      h.appendChild(top); h.appendChild(bot); return h;
    }
    function point(idx, pos, k) {
      const el = document.createElement("div"); el.className = "point " + pos; el.dataset.idx = idx;
      const tri = document.createElement("div"); tri.className = "tri " + triClass(k); el.appendChild(tri);
      const num = document.createElement("span"); num.className = "pt-num"; num.textContent = idx + 1; el.appendChild(num);
      if (selected === idx) el.classList.add("psel");
      if (destSet.has(idx)) { el.classList.add("pdest"); const mk = document.createElement("div"); mk.className = "dest-mark " + pos; el.appendChild(mk); }
      if (bearSet.has(idx)) { el.classList.add("pbear"); const bm = document.createElement("div"); bm.className = "bear-mark " + pos; bm.textContent = pos === "top" ? "⬆" : "⬇"; el.appendChild(bm); }
      if (movSet.has(idx)) { el.classList.add("pmove"); const mm = document.createElement("div"); mm.className = "move-mark " + pos; el.appendChild(mm); }
      if (coachHL) {
        if (coachHL.from === idx) el.classList.add("pcoach");
        if (coachHL.toIdx === idx) { el.classList.add("pcoach"); const cm = document.createElement("div"); cm.className = "coach-mark " + pos; cm.textContent = "➜"; el.appendChild(cm); }
      }
      const cell = points[idx], total = cell.w + cell.b, shown = Math.min(total, 5);
      const pinnedColor = pins[idx];
      for (let s = 0; s < shown; s++) {
        const c = document.createElement("div");
        let col = (pinnedColor && s === 0) ? pinnedColor : (cell.w > 0 ? "w" : "b");
        c.className = "checker " + col; el.appendChild(c);
      }
      if (total > 5) { const cnt = document.createElement("span"); cnt.className = "count"; cnt.textContent = total; el.appendChild(cnt); }
      el.addEventListener("click", () => onPointClick(idx));
      return el;
    }
    function renderBar(barCol) {
      if (movBar) barCol.classList.add("barmove");
      if (coachHL && coachHL.from === "bar") barCol.classList.add("barcoach");
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px;";
      if (bar.b > 0) wrap.appendChild(mkChk("b", bar.b));
      if (bar.w > 0) wrap.appendChild(mkChk("w", bar.w));
      barCol.appendChild(wrap); barCol.style.cursor = "pointer";
      barCol.onclick = () => { if (isHumanTurn() && bar[turn] > 0) { selected = "bar"; render(); info("Επιλέχθηκε πούλι από τη μπάρα — διάλεξε θέση εισόδου."); } };
    }
    function mkChk(col, n) { const c = document.createElement("div"); c.className = "checker " + col + " onbar"; c.textContent = n > 1 ? n : ""; return c; }

    // ---------- ΖΑΡΙΑ ----------
    function roll() {
      if (locked || pendingDouble) return;
      const d6 = () => 1 + Math.floor(Math.random() * 6);
      const who = turn === "w" ? "Λευκά" : "Μαύρα";
      hasRolled = true; aceyStage = null; selected = null;
      // Ταμπλά: 3 ζάρια
      if (variant === "tabula") {
        const a = d6(), b = d6(), c = d6(); dice = [a, b, c];
        if (global.SFX) SFX.dice(); renderDice(true); render();
        info(`${who} έριξαν ${a}-${b}-${c} (3 ζάρια).`); return;
      }
      const a = d6(), b = d6();
      // Ασσόδυο: ειδικός κανόνας 1-2
      if (variant === "asodyo" && ((a===1&&b===2)||(a===2&&b===1))) {
        dice = [1, 2]; aceyStage = "need_double";
        if (global.SFX) SFX.dice(); renderDice(true); render();
        info(`⭐ ΑΣΣΟΔΥΟ! ${who} έριξαν 1-2 — παίξε το 1 και το 2, μετά διάλεξε διπλή!`);
        return;
      }
      // Γκιούλμπαρα: διπλή → παίζεις d..6 (×4 το καθένα) και ρίχνεις ξανά
      if (variant === "gulbara" && a === b) {
        dice = []; for (let n = a; n <= 6; n++) dice.push(n, n, n, n);
        aceyStage = "need_reroll";
        if (global.SFX) SFX.dice(); renderDice(true); render();
        info(`⭐ ΓΚΙΟΥΛΜΠΑΡΑ! Διπλή ${a}-${a} → παίζεις ${a} έως 6 (×4), μετά ρίξε ξανά!`);
        return;
      }
      dice = a === b ? [a,a,a,a] : [a,b];
      if (global.SFX) SFX.dice(); renderDice(true); render();
      info(`${who} έριξαν ${a}-${b}${a===b?" (ντόρτια! 4 κινήσεις)":""}.`);
    }
    // Επιλογή διπλής μετά το ασσόδυο
    function pickDouble(d) {
      dice = [d, d, d, d]; aceyStage = "need_reroll";
      render(); renderDice();
      info(`Διάλεξες διπλή ${d}-${d}! Παίξ' την (4 κινήσεις) και μετά ρίξε ξανά.`);
    }
    function renderDice(animate) {
      emitCube();
      diceEl.innerHTML = ""; diceTray.innerHTML = "";
      if (pendingDouble) {
        const s = document.createElement("span"); s.style.color = "var(--gold2)";
        s.textContent = (vsComputer && other(pendingDouble.by) === aiSide)
          ? "Ο υπολογιστής αποφασίζει για τον διπλασιασμό…"
          : "Πρόταση διπλασιασμού — απάντησε (Take/Pass).";
        diceEl.appendChild(s); return;
      }
      if (!dice.length) {
        if (!isHumanTurn()) {
          const s = document.createElement("span"); s.style.color = "var(--muted)"; s.textContent = "Ο υπολογιστής σκέφτεται…"; diceEl.appendChild(s);
          return;
        }
        if (!hasRolled) {
          const btn = document.createElement("button"); btn.className = "btn gold"; btn.textContent = "🎲 Ρίξε ζάρια";
          btn.onclick = roll; diceEl.appendChild(btn); return;
        }
        if (aceyStage === "need_double") { renderDoublePicker(); return; }
        if (aceyStage === "need_reroll") {
          const btn = document.createElement("button"); btn.className = "btn gold"; btn.textContent = "🎲 Ρίξε ΞΑΝΑ (ασσόδυο)";
          btn.onclick = roll; diceEl.appendChild(btn); return;
        }
        const pass = document.createElement("button"); pass.className = "btn primary"; pass.textContent = "Τέλος σειράς ▸";
        pass.onclick = () => endTurn(); diceEl.appendChild(pass); return;
      }
      // Τα ζάρια πέφτουν ΜΕΣΑ στο ταμπλό (overlay)
      dice.forEach((d, i) => {
        const face = dieFace(d);
        if (animate) { face.classList.add("rolling"); face.style.animationDelay = (i*0.09) + "s"; }
        diceTray.appendChild(face);
      });
      if (isHumanTurn()) {
        const pass = document.createElement("button"); pass.className = "btn"; pass.textContent = "Τέλος σειράς ▸";
        pass.onclick = () => endTurn(); diceEl.appendChild(pass);
      }
    }
    function renderDoublePicker() {
      const lbl = document.createElement("span"); lbl.style.color = "var(--gold2)"; lbl.style.fontWeight = "700"; lbl.textContent = "Διάλεξε διπλή:";
      diceEl.appendChild(lbl);
      for (let d = 1; d <= 6; d++) {
        const b = document.createElement("button"); b.className = "btn"; b.textContent = `${d}-${d}`;
        b.onclick = ((x) => () => pickDouble(x))(d);
        diceEl.appendChild(b);
      }
    }
    function dieFace(v) {
      const d = document.createElement("div"); d.className = "die";
      const grid = document.createElement("div"); grid.className = "die-dots";
      const P = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
      for (let i=0;i<9;i++){ const s=document.createElement("span"); if(!P[v].includes(i)) s.style.visibility="hidden"; grid.appendChild(s); }
      d.appendChild(grid); return d;
    }

    function countExposed(color) {
      const opp = other(color), opth = path(opp); let c = 0;
      for (let i = 0; i < 24; i++) {
        if (points[i][color] === 1 && !(pins[i] && pins[i] !== color)) {
          const tpos = opth.indexOf(i);
          for (let d = 1; d <= 6; d++) { const fp = tpos - d; if (fp >= 0 && points[opth[fp]][opp] > 0) { c++; break; } }
        }
      }
      return c;
    }
    function endTurn() {
      if (dice.length) stats[turn].pipsLost += dice.reduce((a, b) => a + b, 0);
      stats[turn].blots += countExposed(turn);
      const prev = turn;
      turn = other(turn); dice = []; selected = null; hasRolled = false; aceyStage = null; render(); renderDice();
      onTurn(turn, prev);
      if (off.w === 15) return info("🏆 Νίκη Λευκών! Μάζεψαν και τα 15 πούλια.");
      if (off.b === 15) return info("🏆 Νίκη Μαύρων! Μάζεψαν και τα 15 πούλια.");
      info(`Σειρά: ${turn==="w"?"Λευκά":"Μαύρα"}. ${isHumanTurn()?"Ρίξε ζάρια.":""}`);
      maybeAI();
    }

    function isHumanTurn() { return !(vsComputer && turn === aiSide); }

    // ---------- ΚΙΝΗΣΗ (core) ----------
    function onPointClick(idx) {
      if (locked || pendingDouble || !isHumanTurn()) return;
      if (Date.now() - lastDrop < 250) return; // απορρόφησε το click μετά από drag
      if (!dice.length) { info("Ρίξε πρώτα ζάρια."); return; }
      if (bar[turn] > 0 && selected !== "bar") { info("Έχεις πούλι στη μπάρα — κάνε κλικ στη μπάρα για είσοδο."); selected = "bar"; render(); return; }
      if (bearSet.has(idx) && (selected === null || selected === idx)) { bearOffFrom(idx); return; }
      if (selected === null) {
        if (points[idx][turn] > 0 && !(pins[idx] && pins[idx] === turn)) { selected = idx; render(); }
        return;
      }
      const from = selected;
      const fr = topCheckerRect(from);
      const ok = applyMove(from, idx);
      selected = null;
      if (ok) {
        render(); renderDice();
        flyChecker(fr, topCheckerRect(idx), turn);
        if (global.SFX) SFX.place();
        if (!dice.length) info("Τέλειωσαν οι κινήσεις — πάτα «Τέλος σειράς».");
      } else render();
    }

    // Εκτελεί κίνηση from(idx ή 'bar') -> toIdx. Επιστρέφει true αν έγινε.
    function applyMove(from, toIdx) {
      const color = turn, pth = path(color), opp = other(color);
      const fromPos = (from === "bar") ? -1 : pth.indexOf(from);
      const toPos = pth.indexOf(toIdx);
      if (toPos < 0) return false;
      const pips = toPos - fromPos;
      if (pips <= 0) { info("Λάθος κατεύθυνση."); return false; }
      const dieIdx = dice.indexOf(pips);
      if (dieIdx < 0) { info(`Χρειάζεσαι ζάρι ${pips} — δεν το έχεις.`); return false; }
      const dest = points[toIdx];
      if (PORTESLIKE(variant)) {
        if (dest[opp] >= 2) { info("Κλειστή θέση (πόρτα αντιπάλου)."); return false; }
        if (dest[opp] === 1) { dest[opp] = 0; bar[opp]++; stats[color].hits++; stats[opp].gotHit++; info("Χτύπημα! Πούλι αντιπάλου στη μπάρα."); }
      } else if (PLAKOTOLIKE(variant)) {
        if (pins[toIdx] === color) { /* ok */ }
        else if (dest[opp] >= 2) { info("Κλειστή θέση (πόρτα αντιπάλου)."); return false; }
        else if (dest[opp] === 1) { pins[toIdx] = opp; dest[opp] = 0; stats[color].pins++; info("Πλάκωμα! Το πούλι αντιπάλου ακινητοποιήθηκε."); }
      } else if (FEVGALIKE(variant)) {
        if (dest[opp] >= 1) { info("Κλειστή θέση (στη Φεύγα δεν μπαίνεις σε θέση αντιπάλου)."); return false; }
      }
      if (from === "bar") bar[color]--; else points[from][color]--;
      if (PLAKOTOLIKE(variant) && from !== "bar" && points[from][color] === 0 && pins[from] && pins[from] !== color) {
        points[from][pins[from]] = 1; delete pins[from];
      }
      const prevOwn = points[toIdx][color];
      points[toIdx][color]++;
      if (prevOwn === 1) stats[color].points++;
      dice.splice(dieIdx, 1);
      return true;
    }

    // ---------- Animation ολίσθησης ----------
    function topCheckerRect(from) {
      let el;
      if (from === "bar") el = boardEl.querySelector(".bg-bar .checker");
      else { const cs = boardEl.querySelectorAll(`.point[data-idx="${from}"] .checker`); el = cs[cs.length - 1]; }
      return el ? el.getBoundingClientRect() : null;
    }
    function flyChecker(fromRect, toRect, color) {
      if (!fromRect || !toRect) return;
      const g = document.createElement("div"); g.className = "checker " + color + " fly-checker";
      g.style.width = toRect.width + "px"; g.style.height = toRect.height + "px";
      g.style.left = fromRect.left + "px"; g.style.top = fromRect.top + "px";
      document.body.appendChild(g);
      requestAnimationFrame(() => {
        g.style.transition = "left .26s cubic-bezier(.34,.72,.28,1), top .26s cubic-bezier(.34,.72,.28,1)";
        g.style.left = toRect.left + "px"; g.style.top = toRect.top + "px";
      });
      setTimeout(() => g.remove(), 290);
    }
    function flyBearOff(fromRect, color) {
      if (!fromRect) return;
      const g = document.createElement("div"); g.className = "checker " + color + " fly-checker";
      g.style.width = fromRect.width + "px"; g.style.height = fromRect.height + "px";
      g.style.left = fromRect.left + "px"; g.style.top = fromRect.top + "px";
      document.body.appendChild(g);
      const dy = color === "w" ? 52 : -52;
      requestAnimationFrame(() => {
        g.style.transition = "transform .34s ease-in, opacity .34s ease-in";
        g.style.transform = `translateY(${dy}px) scale(1.25)`; g.style.opacity = "0";
      });
      setTimeout(() => g.remove(), 360);
    }
    // Μάζεμα από συγκεκριμένο σημείο (κλικ σε highlighted)
    function bearOffFrom(idx) {
      const color = turn, pth = path(color), pos = pth.indexOf(idx);
      const need = 24 - pos;
      let d = dice.includes(need) ? need : dice.filter(x => x > need).sort((a, b) => a - b)[0];
      if (d == null) return;
      const fr = topCheckerRect(idx);
      points[idx][color]--; off[color]++; dice.splice(dice.indexOf(d), 1);
      if (global.SFX) SFX.place();
      selected = null; render(); renderDice();
      flyBearOff(fr, color);
      info(`Μάζεμα! Σύνολο μαζεμένα: ${off[color]}/15.`);
      if (off[color] === 15) win(color);
    }

    // ---------- Drag & Drop πουλιών ----------
    function chkSize() { const c = boardEl.querySelector(".checker"); return c ? c.getBoundingClientRect().width : 30; }
    function moveGhost(e) { if (!drag) return; const s = chkSize(); drag.ghost.style.left = (e.clientX - s / 2) + "px"; drag.ghost.style.top = (e.clientY - s / 2) + "px"; }
    boardEl.addEventListener("pointerdown", (e) => {
      if (locked || pendingDouble || !isHumanTurn() || !dice.length) return;
      let from;
      if (e.target.closest(".bg-bar")) { if (bar[turn] > 0) from = "bar"; }
      else { const pt = e.target.closest(".point"); if (pt) { const idx = +pt.dataset.idx; if (points[idx][turn] > 0 && pins[idx] !== turn) from = idx; } }
      if (from === undefined) return;
      if (bar[turn] > 0 && from !== "bar") return;
      e.preventDefault();
      selected = from; render();
      const s = chkSize();
      const g = document.createElement("div"); g.className = "checker " + turn + " drag-checker";
      g.style.width = s + "px"; g.style.height = s + "px";
      document.body.appendChild(g);
      drag = { from, ghost: g, moved: false }; moveGhost(e);
    });
    window.addEventListener("pointermove", (e) => { if (drag) { drag.moved = true; moveGhost(e); } });
    window.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const from = drag.from, moved = drag.moved;
      drag.ghost.remove(); drag = null;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const pt = el && el.closest(".point");
      if (pt && pt.closest(".bg-board") === boardEl) {
        const to = +pt.dataset.idx;
        if (to !== from) {
          const ok = applyMove(from, to);
          if (ok) {
            if (global.SFX) SFX.place();
            lastDrop = Date.now(); selected = null; render(); renderDice();
            if (!dice.length) info("Τέλειωσαν οι κινήσεις — πάτα «Τέλος σειράς».");
            return;
          }
        }
      }
      if (moved) { lastDrop = Date.now(); selected = null; }
      render();
    });

    function bearOff(silent) {
      const color = turn;
      if (!allHome(color)) { if (!silent) info("Δεν μπορείς να μαζέψεις — δεν είναι όλα τα πούλια στην οικία."); return false; }
      const pth = path(color);
      for (const d of dice.slice().sort((x,y)=>y-x)) {
        const posNeeded = 24 - d;
        // exact
        if (posNeeded >= 18 && points[pth[posNeeded]] && points[pth[posNeeded]][color] > 0) {
          points[pth[posNeeded]][color]--; off[color]++; dice.splice(dice.indexOf(d),1);
          if (global.SFX) SFX.place();
          if (!silent) { render(); renderDice(); info(`Μάζεμα! Σύνολο μαζεμένα: ${off[color]}/15.`); if (off[color]===15) win(color); }
          return true;
        }
        // overflow: μεγαλύτερο ζάρι μαζεύει το πιο πίσω πούλι
        for (let pos = 18; pos < 24; pos++) {
          if (points[pth[pos]][color] > 0) {
            if ((24 - pos) <= d) {
              points[pth[pos]][color]--; off[color]++; dice.splice(dice.indexOf(d),1);
              if (global.SFX) SFX.place();
              if (!silent) { render(); renderDice(); info(`Μάζεμα! Σύνολο μαζεμένα: ${off[color]}/15.`); if (off[color]===15) win(color); }
              return true;
            }
            break;
          }
        }
      }
      if (!silent) info("Κανένα ζάρι δεν ταιριάζει για μάζεμα.");
      return false;
    }
    function win(c) {
      const loser = other(c), gammon = off[loser] === 0 ? 2 : 1;
      gameEnd(c, cubeValue * gammon, gammon === 2 ? "gammon" : "bear");
    }

    // ================= Doubling Cube + Σκορ ματς =================
    function emitCube() {
      const responder = pendingDouble ? other(pendingDouble.by) : null;
      const humanResponder = pendingDouble && !(vsComputer && responder === aiSide);
      onCube({
        value: cubeValue, owner: cubeOwner, proposed: cubeValue * 2,
        scoreW: score.w, scoreB: score.b, target, matchOver,
        canDouble: !pendingDouble && !locked && !hasRolled && dice.length === 0 &&
          isHumanTurn() && (cubeOwner === null || cubeOwner === turn) && cubeValue < 64,
        awaitingHuman: !!humanResponder,
      });
    }
    function double() {
      if (pendingDouble || locked) return;
      if (!(cubeOwner === null || cubeOwner === turn) || cubeValue >= 64) return;
      pendingDouble = { by: turn };
      info(`${turn === "w" ? "Λευκά" : "Μαύρα"} προτείνουν διπλασιασμό σε ×${cubeValue * 2}!`);
      render(); renderDice();
      if (vsComputer && other(turn) === aiSide) setTimeout(aiRespondDouble, 900);
    }
    function respond(accept) {
      if (!pendingDouble) return;
      const by = pendingDouble.by;
      if (accept) {
        cubeValue *= 2; cubeOwner = other(by); pendingDouble = null;
        info(`Δέχτηκε ο διπλασιασμός — ο κύβος στο ×${cubeValue}.`);
        render(); renderDice();
        if (vsComputer && by === aiSide) resumeAiTurn();
      } else {
        pendingDouble = null;
        gameEnd(by, cubeValue, "pass"); // ο διπλασιάζων κερδίζει την τρέχουσα αξία
      }
    }
    function aiRespondDouble() {
      if (!pendingDouble) return;
      const accept = pip(aiSide) <= pip(pendingDouble.by) * 1.18;
      info(`Ο υπολογιστής ${accept ? "δέχεται (take)" : "παρατάει (pass)"}.`);
      respond(accept);
    }
    function aiShouldDouble() {
      if (pendingDouble || locked || cubeValue >= 64) return false;
      if (!(cubeOwner === null || cubeOwner === aiSide)) return false;
      const my = pip(aiSide), opp = pip(other(aiSide));
      return my < opp * 0.90 && my > opp * 0.55 && Math.random() < 0.6;
    }
    function resumeAiTurn() { aiBusy = true; renderDice(); setTimeout(() => { roll(); setTimeout(aiStep, 650); }, 450); }
    function gameEnd(winner, points, reason) {
      score[winner] += points; locked = true;
      onGameResult({ winner, points, reason, vs: vsComputer, aiSide, stats: { w: Object.assign({}, stats.w), b: Object.assign({}, stats.b), variant } });
      if (score[winner] >= target) {
        matchOver = true;
        info(`🏆 ΝΙΚΗ ΜΑΤΣ ${winner === "w" ? "Λευκών" : "Μαύρων"}! Τελικό σκορ ${score.w}-${score.b}.`);
      } else {
        const r = reason === "pass" ? "pass" : reason === "gammon" ? "γκάμον ×2" : "μάζεμα";
        info(`${winner === "w" ? "Λευκά" : "Μαύρα"} +${points} πόντ. (${r}). Σκορ ${score.w}-${score.b}. Πάτα «Νέο» για επόμενο.`);
      }
      render(); renderDice(); onWin(winner);
    }
    function newMatch(t) { if (t) target = t; score = { w: 0, b: 0 }; matchOver = false; reset(); }

    // ---------- AI ----------
    function enumerateMoves(color) {
      const res = [], pth = path(color), opp = other(color);
      const uniq = [...new Set(dice)];
      if (bar[color] > 0) {
        for (const d of uniq) {
          const toIdx = pth[d-1], dest = points[toIdx];
          if (FEVGALIKE(variant)) { if (dest[opp] >= 1) continue; }
          else { if (dest[opp] >= 2) continue; }
          res.push({ from: "bar", toIdx, die: d });
        }
        return res;
      }
      for (const d of uniq) {
        for (let idx = 0; idx < 24; idx++) {
          if (points[idx][color] <= 0) continue;
          if (pins[idx] === color) continue;
          const fp = pth.indexOf(idx), tp = fp + d;
          if (tp >= 24) continue;
          const toIdx = pth[tp], dest = points[toIdx];
          let ok = true;
          if (PORTESLIKE(variant)) { if (dest[opp] >= 2) ok = false; }
          else if (PLAKOTOLIKE(variant)) { if (pins[toIdx] && pins[toIdx] !== color) ok = dest[opp] < 2; else if (dest[opp] >= 2) ok = false; }
          else if (FEVGALIKE(variant)) { if (dest[opp] >= 1) ok = false; }
          if (ok) res.push({ from: idx, toIdx, die: d });
        }
      }
      return res;
    }
    // Κίνδυνος «πλακιού»: πόσα εχθρικά πούλια μπορούν να χτυπήσουν το toIdx (απόσταση 1-6)
    function blotRisk(toIdx) {
      const opp = other(turn), opth = path(opp), tpos = opth.indexOf(toIdx);
      if (tpos < 0) return 0;
      let hitters = 0;
      for (let d = 1; d <= 6; d++) { const fp = tpos - d; if (fp >= 0 && points[opth[fp]][opp] > 0) hitters++; }
      return hitters;
    }
    function scoreMove(mv) {
      const color = turn, opp = other(color), pth = path(color);
      const dest = points[mv.toIdx];
      let s = pth.indexOf(mv.toIdx) * 0.6;
      if (PORTESLIKE(variant) && dest[opp] === 1) s += 70;
      if (PLAKOTOLIKE(variant) && dest[opp] === 1) s += 65 + pth.indexOf(mv.toIdx) * 0.3;
      if (dest[color] >= 1) s += 25;
      if (FEVGALIKE(variant) && dest[color] >= 1) s += 15;
      const leavesBlot = dest[color] === 0 && !(PORTESLIKE(variant) && dest[opp] === 1) && !FEVGALIKE(variant);
      if (leavesBlot) {
        if (aiLevel === 2) s -= 12;
        else if (aiLevel === 3) s -= 14 + blotRisk(mv.toIdx) * 9; // Δυνατός: αποφεύγει εκτεθειμένα πλακιά
        // Εύκολος (1): αγνοεί τον κίνδυνο
      }
      if (mv.from !== "bar" && points[mv.from][color] === 2) s -= (aiLevel === 3 ? 12 : 8);
      const jitter = aiLevel === 1 ? Math.random() * 45 : aiLevel === 2 ? Math.random() * 3 : 0;
      return s + jitter;
    }

    // ---- Επίπεδο «Πρωταθλητής»: αξιολόγηση ΟΛΗΣ της θέσης (pip + δομή + κίνδυνος) ----
    const SHOTS = { 1: 11, 2: 12, 3: 14, 4: 15, 5: 15, 6: 17 };
    function cloneState() {
      return { points: points.map(c => ({ w: c.w, b: c.b })), bar: { w: bar.w, b: bar.b }, pins: Object.assign({}, pins) };
    }
    function simLand(S, color, from, toIdx) {
      const opp = other(color), dest = S.points[toIdx];
      if (PORTESLIKE(variant)) { if (dest[opp] === 1) { dest[opp] = 0; S.bar[opp]++; } }
      else if (PLAKOTOLIKE(variant)) { if (S.pins[toIdx] !== color && dest[opp] === 1) { S.pins[toIdx] = opp; dest[opp] = 0; } }
      if (from === "bar") S.bar[color]--;
      else {
        S.points[from][color]--;
        if (PLAKOTOLIKE(variant) && S.points[from][color] === 0 && S.pins[from] && S.pins[from] !== color) { S.points[from][S.pins[from]] = 1; delete S.pins[from]; }
      }
      S.points[toIdx][color]++;
    }
    function pipS(S, c) {
      const pth = path(c); let t = S.bar[c] * 25;
      for (let i = 0; i < 24; i++) { let n = S.points[i][c]; if (S.pins[i] === c) n += 1; if (n > 0) t += n * (24 - pth.indexOf(i)); }
      return t;
    }
    function hitWaysS(S, idx, color) {
      const opp = other(color), opth = path(opp), tpos = opth.indexOf(idx);
      if (tpos < 0) return 0;
      let ways = 0;
      for (let d = 1; d <= 6; d++) { const fp = tpos - d; if (fp >= 0 && S.points[opth[fp]][opp] > 0) ways += SHOTS[d]; }
      return Math.min(ways, 24);
    }
    function evalState(S, color) {
      const opp = other(color);
      let s = pipS(S, opp) - pipS(S, color); // προβάδισμα στην κούρσα
      for (let i = 0; i < 24; i++) {
        const n = S.points[i][color];
        if (n >= 2) s += 4;                               // φτιαγμένη πόρτα
        if (n === 1 && S.pins[i] !== color && PORTESLIKE(variant)) s -= hitWaysS(S, i, color) * 0.5; // εκτεθειμένο πλακί (προεπισκόπηση χτυπήματος)
        if (S.pins[i] === opp) s += 12;                   // πλακωμένο/φυλακισμένο αντιπάλου
      }
      return s;
    }
    function scoreMoveChampion(mv) {
      const S = cloneState();
      simLand(S, turn, mv.from, mv.toIdx);
      return evalState(S, turn);
    }

    // ---- Προπονητής: προτεινόμενη κίνηση + εξήγηση ----
    function suggestMove() {
      const moves = enumerateMoves(turn);
      if (!moves.length) return null;
      moves.sort((a, b) => scoreMoveChampion(b) - scoreMoveChampion(a));
      const m = moves[0];
      return { from: m.from, toIdx: m.toIdx, reason: coachReason(m) };
    }
    function coachReason(m) {
      const color = turn, opp = other(color), dest = points[m.toIdx];
      if (PORTESLIKE(variant) && dest[opp] === 1) return "🎯 Χτυπάει το πλακί του αντιπάλου — τον στέλνει στη μπάρα και κερδίζεις χρόνο!";
      if (PLAKOTOLIKE(variant) && dest[opp] === 1) return "🔒 Πλακώνει πούλι του αντιπάλου — το ακινητοποιεί, τεράστιο πλεονέκτημα.";
      if (dest[color] >= 1) return "🚪 Φτιάχνει/ενισχύει πόρτα — κλείνει θέση και μπλοκάρει τον αντίπαλο.";
      if (m.from === "bar") return "↩️ Μπάζει πούλι από τη μπάρα πίσω στο παιχνίδι (υποχρεωτικό πρώτα).";
      if (dest[color] === 0 && PORTESLIKE(variant) && blotRisk(m.toIdx) > 0) return "➡️ Καλή προώθηση — αλλά αφήνει «πλακί»· υπολόγισε το ρίσκο χτυπήματος.";
      return "➡️ Ασφαλής προώθηση προς την οικία σου — χτίζει την κούρσα.";
    }
    function maybeAI() {
      if (locked || !vsComputer || turn !== aiSide || aiBusy || pendingDouble) return;
      if (off.w === 15 || off.b === 15) return;
      if (aiShouldDouble()) { double(); return; }
      aiBusy = true;
      renderDice();
      setTimeout(() => { roll(); setTimeout(aiStep, 650); }, 500);
    }
    function chooseAiDouble() {
      let best = 6, bestC = -1;
      for (const d of [6,5,4,3,2,1]) { dice = [d,d,d,d]; const c = enumerateMoves(turn).length; if (c > bestC) { bestC = c; best = d; } }
      dice = [best, best, best, best]; aceyStage = "need_reroll";
      info(`Ο υπολογιστής (ασσόδυο) διάλεξε διπλή ${best}-${best}.`);
    }
    function aiStep() {
      if (off[turn] === 15) { aiBusy = false; return; }
      if (!dice.length) {
        if (aceyStage === "need_double") { chooseAiDouble(); render(); renderDice(); setTimeout(aiStep, 560); return; }
        if (aceyStage === "need_reroll") { roll(); setTimeout(aiStep, 650); return; }
        aiBusy = false; endTurn(); return;
      }
      const moves = enumerateMoves(turn);
      if (moves.length) {
        let best;
        if (aiLevel === 1 && Math.random() < 0.5) best = moves[Math.floor(Math.random() * moves.length)];
        else {
          const scorer = aiLevel === 4 ? scoreMoveChampion : scoreMove;
          moves.sort((a, b) => scorer(b) - scorer(a)); best = moves[0];
        }
        const fr = topCheckerRect(best.from);
        applyMove(best.from, best.toIdx);
        render(); renderDice();
        flyChecker(fr, topCheckerRect(best.toIdx), turn);
        if (global.SFX) SFX.place();
        setTimeout(aiStep, 560);
      } else if (allHome(turn)) {
        const before = off[turn];
        bearOff(true); render(); renderDice();
        if (off[turn] === 15) { win(turn); aiBusy = false; return; }
        if (off[turn] > before) setTimeout(aiStep, 560);
        else { aiBusy = false; endTurn(); }
      } else {
        info(`${turn==="w"?"Λευκά":"Μαύρα"} (υπολογιστής): μπλοκαρισμένος, πέρασε.`);
        aiBusy = false; setTimeout(() => endTurn(), 500);
      }
    }

    function info(msg) { onInfo(msg, { turn, dice: dice.slice(), off: Object.assign({}, off), bar: Object.assign({}, bar) }); }

    reset(variant);

    return {
      el: boardEl, reset, roll,
      bearOff: () => { if (isHumanTurn()) { bearOff(false); } },
      setVariant: (v) => reset(v),
      setVs: (v) => { vsComputer = !!v; reset(); },
      setAiSide: (c) => { aiSide = c; reset(); },
      setAiLevel: (n) => { aiLevel = n; },
      setLocked: (v) => { locked = !!v; },
      setCoach: (v) => { coachOn = !!v; render(); },
      getSummary: () => ({ w: Object.assign({}, stats.w), b: Object.assign({}, stats.b), variant }),
      double, respond, newMatch,
      getInfo: () => ({ turn, variant, off, bar }),
    };
  }
  global.createTavli = createTavli;
})(window);
