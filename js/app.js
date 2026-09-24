/* ΣΚΑΚΙ & ΤΑΒΛΙ 360° — app.js (glue) */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const D = window.DATA;

  // ---------------- Navigation ----------------
  function showView(v) {
    $$(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + v));
    $$("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$("#tabs button").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
  $$("[data-goto]").forEach(el => el.addEventListener("click", () => showView(el.dataset.goto)));

  function wireSubnav(navId) {
    const nav = $("#" + navId);
    $$("button", nav).forEach(btn => btn.addEventListener("click", () => {
      $$("button", nav).forEach(b => b.classList.toggle("active", b === btn));
      const parent = nav.closest(".view");
      $$(".sub", parent).forEach(s => s.classList.toggle("active", s.id === "sub-" + btn.dataset.sub));
      // lazy init boards
      if (btn.dataset.sub === "c-play") initPlay();
      if (btn.dataset.sub === "c-open") initOpenings();
      if (btn.dataset.sub === "c-puzzle") initPuzzles();
      if (btn.dataset.sub === "t-play") initTavli();
      if (btn.dataset.sub === "t-cube") initDoubling();
    }));
  }
  wireSubnav("chess-subnav");
  wireSubnav("tavli-subnav");

  // ======================================================
  //  ΣΚΑΚΙ — Παίξε (vs AI)
  // ======================================================
  let playBoard = null;
  let playMovesArr = [];

  // ---------------- Σκακιστικό ρολόι ----------------
  const clock = { enabled: false, base: 0, inc: 0, w: 0, b: 0, active: null, timer: null, last: 0, flagged: false };
  function parseTC(v) { if (!v || v === "off") return null; const p = v.split("+").map(Number); return { base: p[0], inc: p[1] || 0 }; }
  function fmtClock(sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    const base = m + ":" + String(s).padStart(2, "0");
    return sec < 20 ? base + "." + Math.floor((sec * 10) % 10) : base;
  }
  function renderClock() {
    const cw = $("#clock-w"), cb = $("#clock-b");
    if (!cw) return;
    $("#clock-w-t").textContent = clock.enabled ? fmtClock(clock.w) : "--:--";
    $("#clock-b-t").textContent = clock.enabled ? fmtClock(clock.b) : "--:--";
    cw.classList.toggle("active", clock.active === "w");
    cb.classList.toggle("active", clock.active === "b");
    cw.classList.toggle("low", clock.enabled && clock.w < 20);
    cb.classList.toggle("low", clock.enabled && clock.b < 20);
  }
  function stopClock() { if (clock.timer) { clearInterval(clock.timer); clock.timer = null; } clock.active = null; renderClock(); }
  function tickLoop() {
    if (!clock.timer) return;
    const now = performance.now(), dt = (now - clock.last) / 1000; clock.last = now;
    if (clock.active && !clock.flagged) {
      clock[clock.active] -= dt;
      if (clock[clock.active] <= 0) { clock[clock.active] = 0; onFlag(clock.active); return; }
    }
    renderClock();
  }
  function runClock(side) { clock.active = side; clock.last = performance.now(); if (!clock.timer) clock.timer = setInterval(tickLoop, 100); renderClock(); }
  function onFlag(side) {
    stopClock(); clock.flagged = true;
    $("#clock-" + side).classList.add("flag");
    const line = $("#play-status");
    line.textContent = `⏱️ ${side === "w" ? "Λευκά" : "Μαύρα"} έχασαν στον χρόνο — νίκη ${side === "w" ? "Μαύρων" : "Λευκών"}! 🏆`;
    line.className = "status-line win";
    if (playBoard) playBoard.setInteractive(false);
    recordChess(side === "w" ? "b" : "w", "Χρόνος");
  }
  function startClockGame() {
    const tc = parseTC($("#play-clock") ? $("#play-clock").value : "off");
    clock.flagged = false;
    if ($("#clock-w")) { $("#clock-w").classList.remove("flag"); $("#clock-b").classList.remove("flag"); }
    if (!tc) { clock.enabled = false; stopClock(); if ($("#chess-clocks")) $("#chess-clocks").style.display = "none"; return; }
    clock.enabled = true; clock.base = tc.base; clock.inc = tc.inc; clock.w = tc.base; clock.b = tc.base;
    $("#chess-clocks").style.display = "flex";
    runClock(playBoard.turn());
  }
  function clockOnMove(newTurn, terminal) {
    if (!clock.enabled || clock.flagged) return;
    if (terminal) { stopClock(); return; }
    const moved = newTurn === "w" ? "b" : "w";
    clock[moved] += clock.inc;
    runClock(newTurn);
  }

  // ---------------- Ιστορικό & στατιστικά (μόνιμα) ----------------
  const HKEY = { chess: "skakitavli_hist_chess_v1", tavli: "skakitavli_hist_tavli_v1" };
  function loadH(k) { try { return JSON.parse(localStorage.getItem(HKEY[k])) || []; } catch (e) { return []; } }
  function saveH(k, a) { try { localStorage.setItem(HKEY[k], JSON.stringify(a)); } catch (e) {} }
  let histChess = loadH("chess"), histTavli = loadH("tavli"), chessRecorded = false;
  function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }
  function calcStreak(winners) {
    let len = 0, who = null;
    for (let i = winners.length - 1; i >= 0; i--) {
      const w = winners[i];
      if (who === null) { if (w) { who = w; len = 1; } else break; }
      else if (w === who) len++; else break;
    }
    return { len, who };
  }
  function histRows(h, mapper) {
    const rows = h.slice(-40);
    return rows.map((g, i) => mapper(g, h.length - rows.length + i + 1)).reverse().join("");
  }

  function renderChessStats() {
    const el = $("#chess-stats"); if (!el) return;
    const h = histChess; if (!h.length) { el.innerHTML = ""; return; }
    const w = h.filter(g => g.winner === "w").length, b = h.filter(g => g.winner === "b").length, d = h.filter(g => !g.winner).length;
    const vsAI = h.filter(g => g.vs && g.human);
    const youW = vsAI.filter(g => g.winner === g.human).length, aiW = vsAI.filter(g => g.winner && g.winner !== g.human).length;
    const st = calcStreak(h.map(g => g.winner));
    let s = `<span class="stat">Σύνολο: <b>${h.length}</b></span><span class="stat">⚪ <b>${w}</b> – <b>${b}</b> ⚫</span><span class="stat">Ισοπαλίες: <b>${d}</b></span>`;
    if (youW + aiW) s += `<span class="stat hl">Εσύ <b>${youW}</b> – <b>${aiW}</b> Υπολογιστής (${pct(youW, youW + aiW)}%)</span>`;
    if (st.len >= 2) s += `<span class="stat">Σερί: <b>${st.len}</b> ${st.who === "w" ? "⚪" : "⚫"}</span>`;
    el.innerHTML = s;
  }
  function renderChessHistory() {
    const el = $("#chess-history"); if (!el) return;
    el.innerHTML = histRows(histChess, (g, n) => {
      let who = g.winner === "w" ? '<span class="who w">⚪ Λευκά</span>' : g.winner === "b" ? '<span class="who b">⚫ Μαύρα</span>' : '<span class="who draw">Ισοπαλία</span>';
      return `<div class="hist-item"><span>#${n}: ${who}</span><span class="det">${g.reason}</span></div>`;
    });
    renderChessStats();
  }
  function recordChess(winner, reason) {
    if (chessRecorded) return;
    chessRecorded = true;
    histChess.push({ winner, reason, vs: $("#play-vs").checked, human: $("#play-vs").checked ? $("#play-side").value : null, ts: Date.now() });
    saveH("chess", histChess);
    renderChessHistory();
  }

  function renderTavliStats() {
    const el = $("#tavli-stats"); if (!el) return;
    const h = histTavli; if (!h.length) { el.innerHTML = ""; return; }
    const w = h.filter(g => g.winner === "w").length, b = h.filter(g => g.winner === "b").length;
    const ptsW = h.filter(g => g.winner === "w").reduce((s, g) => s + g.points, 0);
    const ptsB = h.filter(g => g.winner === "b").reduce((s, g) => s + g.points, 0);
    const gammons = h.filter(g => g.reason === "gammon").length;
    const vsAI = h.filter(g => g.vs && g.human);
    const youW = vsAI.filter(g => g.winner === g.human).length, aiW = vsAI.filter(g => g.winner !== g.human).length;
    const st = calcStreak(h.map(g => g.winner));
    let s = `<span class="stat">Παιχνίδια: <b>${h.length}</b></span><span class="stat">⚪ <b>${w}</b> – <b>${b}</b> ⚫</span><span class="stat">Πόντοι ⚪<b>${ptsW}</b>–<b>${ptsB}</b>⚫</span><span class="stat">Γκάμον: <b>${gammons}</b></span>`;
    if (youW + aiW) s += `<span class="stat hl">Εσύ <b>${youW}</b> – <b>${aiW}</b> Υπολογιστής (${pct(youW, youW + aiW)}%)</span>`;
    if (st.len >= 2) s += `<span class="stat">Σερί: <b>${st.len}</b> ${st.who === "w" ? "⚪" : "⚫"}</span>`;
    el.innerHTML = s;
  }
  function renderTavliHistory() {
    const el = $("#tavli-history"); if (!el) return;
    el.innerHTML = histRows(histTavli, (g, n) => {
      const who = g.winner === "w" ? '<span class="who w">⚪ Λευκά</span>' : '<span class="who b">⚫ Μαύρα</span>';
      const r = g.reason === "pass" ? "pass" : g.reason === "gammon" ? "γκάμον ×2" : "μάζεμα";
      return `<div class="hist-item"><span>#${n}: ${who}</span><span class="det">+${g.points} (${r})</span></div>`;
    });
    renderTavliStats();
  }
  function recordTavli(res) {
    const human = res.vs ? (res.aiSide === "w" ? "b" : "w") : null;
    histTavli.push({ winner: res.winner, points: res.points, reason: res.reason, vs: res.vs, human, ts: Date.now() });
    saveH("tavli", histTavli);
    renderTavliHistory();
    if (res.stats) renderTavliSummary(res.stats, res.vs ? (res.aiSide === "w" ? "b" : "w") : null);
  }
  function tavliTips(s, plakotoLike) {
    const t = [];
    if (!plakotoLike) {
      if (s.blots >= 4) t.push("Αφήνεις πολλά εκτεθειμένα «πλακιά» — προτίμησε κινήσεις που φτιάχνουν πόρτες ή κρύβουν τα μονά πούλια.");
      if (s.gotHit >= 3) t.push("Σε χτύπησαν αρκετά — μην αφήνεις μονά πούλια κοντά στα πούλια του αντιπάλου.");
      if (s.hits === 0) t.push("Δεν έκανες χτυπήματα — όταν ο αντίπαλος αφήνει «πλακί», χτύπα το για να κερδίσεις χρόνο.");
    } else {
      if (s.pins === 0) t.push("Δεν πλάκωσες πούλια — ψάξε ευκαιρίες να ακινητοποιήσεις πούλι του αντιπάλου, ειδικά κοντά στην έξοδό του.");
    }
    if (s.points <= 1) t.push("Έφτιαξες λίγες πόρτες — χτίσε συνεχόμενα σημεία (φράγμα) για να μπλοκάρεις τον αντίπαλο.");
    if (s.pipsLost >= 4) t.push("Έχασες πόντους από τα ζάρια — σχεδίασε τις κινήσεις ώστε να παίζεις ΟΛΑ τα ζάρια σου.");
    if (!t.length) t.push("Πολύ καλό παιχνίδι! Συνέχισε να ισορροπείς ασφάλεια και ταχύτητα.");
    return t;
  }
  function renderTavliSummary(sum, humanSide) {
    const el = $("#tavli-summary"); if (!el) return;
    if (!sum) { el.innerHTML = ""; return; }
    const plakotoLike = ["plakoto", "tapa", "mahbusa"].includes(sum.variant);
    const rows = [
      ["🎯 Χτυπήματα", "hits", !plakotoLike],
      ["🔒 Πλακώματα", "pins", plakotoLike],
      ["💥 Χτυπήθηκες", "gotHit", !plakotoLike],
      ["🚪 Πόρτες που έφτιαξες", "points", true],
      ["⚠️ Εκτεθειμένα πλακιά", "blots", !plakotoLike],
      ["🎲 Χαμένοι πόντοι ζαριού", "pipsLost", true],
    ];
    let html = `<div class="hist-item" style="font-weight:600;color:var(--gold2)"><span>Σύνοψη παιχνιδιού</span><span>⚪ / ⚫</span></div>`;
    html += rows.filter(r => r[2]).map(([label, key]) => `<div class="hist-item"><span>${label}</span><span class="det"><b>${sum.w[key]}</b> / <b>${sum.b[key]}</b></span></div>`).join("");
    el.innerHTML = html;
    // Συμβουλές βελτίωσης
    const tipEl = $("#tavli-tips"); if (!tipEl) return;
    const block = (side, label) => {
      const tips = tavliTips(sum[side], plakotoLike);
      return `<div class="coach-tip"><b>🧭 Συμβουλές (${label}):</b><ul style="margin:6px 0 0;padding-left:18px">${tips.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
    };
    if (humanSide) tipEl.innerHTML = block(humanSide, "εσένα");
    else tipEl.innerHTML = block("w", "⚪ Λευκά") + block("b", "⚫ Μαύρα");
  }
  function statusText(st, turn) {
    const who = turn === "w" ? "Λευκά" : "Μαύρα";
    switch (st) {
      case "checkmate": return { txt: `Ματ! Νίκη ${turn === "w" ? "Μαύρων" : "Λευκών"} 🏆`, cls: "win" };
      case "stalemate": return { txt: "Πατ — Ισοπαλία 🤝", cls: "win" };
      case "draw50": return { txt: "Ισοπαλία (κανόνας 50 κινήσεων) 🤝", cls: "win" };
      case "insufficient": return { txt: "Ισοπαλία (ανεπαρκές υλικό) 🤝", cls: "win" };
      case "check": return { txt: `Σαχ! Σειρά: ${who}`, cls: "" };
      default: return { txt: `Σειρά: ${who}`, cls: "" };
    }
  }
  function renderPlayMoves(curIdx) {
    const el = $("#play-moves");
    let html = "";
    for (let i = 0; i < playMovesArr.length; i += 2) {
      html += `<span class="num">${i / 2 + 1}.</span> `;
      html += `<span class="mv">${playMovesArr[i] || ""}</span> `;
      if (playMovesArr[i + 1]) html += `<span class="mv">${playMovesArr[i + 1]}</span> `;
    }
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }
  function updatePlayStatus() {
    const s = playBoard.getState();
    const st = playBoard.status();
    const info = statusText(st, s.turn);
    const line = $("#play-status");
    line.textContent = info.txt;
    line.className = "status-line " + (info.cls || ("turn-" + s.turn));
    $("#play-undo").disabled = !playBoard.canUndo();
  }
  function maybeAIMove() {
    if (clock.flagged) return;
    if (!$("#play-vs").checked) return;
    const human = $("#play-side").value;
    const s = playBoard.getState();
    const st = playBoard.status();
    if (st === "checkmate" || st === "stalemate" || st === "draw50" || st === "insufficient") return;
    if (s.turn !== human) {
      playBoard.setInteractive(false);
      setTimeout(() => {
        playBoard.aiMove(parseInt($("#play-depth").value, 10));
        playBoard.setInteractive(true);
      }, 250);
    }
  }
  // ---------------- Προπονητής σκακιού ----------------
  function pieceNameGr(t) { return { p: "πιόνι", n: "ίππο", b: "αξιωματικό", r: "πύργο", q: "βασίλισσα", k: "βασιλιά" }[t] || "κομμάτι"; }
  function reasonForChess(state, m) {
    const p = state.board[m.from];
    const san = Chess.toSAN(state, m);
    const captured = m.ep || state.board[m.to];
    const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    if (san.includes("#")) return "🏁 <b>Ματ!</b> Τελειώνει την παρτίδα.";
    if (san.includes("+")) return captured ? "Δίνει <b>σαχ</b> και κερδίζει υλικό." : "Δίνει <b>σαχ</b> — αναγκάζει τον αντίπαλο να αμυνθεί.";
    if (m.castle) return "<b>Ροκέ</b>: ασφαλίζει τον βασιλιά και ενεργοποιεί τον πύργο.";
    if (captured) {
      if (V[captured.t] > V[p.t]) return `Κερδίζει υλικό — τρώει <b>${pieceNameGr(captured.t)}</b> με μικρότερο κομμάτι.`;
      if (V[captured.t] === V[p.t]) return `Ισότιμη αλλαγή — τρώει ${pieceNameGr(captured.t)}.`;
      return `Αιχμαλωσία ${pieceNameGr(captured.t)}.`;
    }
    const fr = Chess.rc(m.from)[0], backRank = p.c === "w" ? 7 : 0, dest = Chess.sqName(m.to);
    if ((p.t === "n" || p.t === "b") && fr === backRank) return `<b>Ανάπτυξη</b>: βγάζει τον ${pieceNameGr(p.t)} στο παιχνίδι.`;
    if (p.t === "p" && ["d4", "e4", "d5", "e5"].includes(dest)) return "<b>Έλεγχος κέντρου</b> — κερδίζει χώρο και γραμμές.";
    if (p.t === "p") return "Προωθεί πιόνι / ανοίγει γραμμές.";
    if (p.t === "r") return "Φέρνει τον <b>πύργο</b> σε ενεργή/ανοιχτή στήλη.";
    if (p.t === "q" && fr === backRank) return "Ενεργοποιεί τη βασίλισσα (χωρίς να εκτεθεί).";
    if (p.t === "k") return "Βελτιώνει τη θέση/ασφάλεια του βασιλιά.";
    return "Βελτιώνει τη θέση σου.";
  }
  function updateChessCoach() {
    if (!playBoard) return;
    const tip = $("#play-coach-tip");
    const st = playBoard.status(), state = playBoard.getState();
    const terminal = st === "checkmate" || st === "stalemate" || st === "draw50" || st === "insufficient";
    const vs = $("#play-vs").checked, humanToMove = !vs || state.turn === $("#play-side").value;
    if (!$("#play-coach").checked || terminal || !humanToMove || clock.flagged) {
      playBoard.clearHint(); if (tip) tip.innerHTML = ""; return;
    }
    const best = Chess.bestMove(state, 3);
    if (!best) { playBoard.clearHint(); if (tip) tip.innerHTML = ""; return; }
    playBoard.setHint(best);
    if (tip) tip.innerHTML = `💡 Προτεινόμενη: <b>${Chess.toSAN(state, best)}</b> — ${reasonForChess(state, best)}`;
  }

  // ---------------- Ανάλυση παρτίδας (σκάκι) ----------------
  function analyzeChessGame() {
    const panel = $("#chess-analysis"); if (!panel) return;
    if (!playMovesArr.length) { panel.innerHTML = "<div class='an-ok'>Δεν υπάρχει παρτίδα για ανάλυση ακόμη.</div>"; return; }
    panel.innerHTML = "<div class='an-ok'>⏳ Αναλύω την παρτίδα…</div>";
    setTimeout(() => {
      const DEP = 2;
      let state = Chess.fromFEN(Chess.START_FEN);
      const rows = [], counts = { w: { bl: 0, mi: 0, in: 0 }, b: { bl: 0, mi: 0, in: 0 } };
      for (let i = 0; i < playMovesArr.length; i++) {
        const cleanSan = playMovesArr[i].replace(/[+#!?]/g, "");
        const legal = Chess.legalMoves(state);
        const played = legal.find(m => Chess.toSAN(state, m).replace(/[+#!?]/g, "") === cleanSan);
        if (!played) break;
        const side = state.turn;
        const bestInfo = Chess.evalForMover(state, DEP);
        const playedScore = Chess.scoreOfMove(state, played, DEP);
        let loss = bestInfo.best - playedScore; if (loss < 0) loss = 0;
        let cls = null;
        if (loss >= 300) { cls = "bl"; counts[side].bl++; }
        else if (loss >= 120) { cls = "mi"; counts[side].mi++; }
        else if (loss >= 50) { cls = "in"; counts[side].in++; }
        if (cls) rows.push({ no: Math.floor(i / 2) + 1, side, san: playMovesArr[i], bestSan: bestInfo.move ? Chess.toSAN(state, bestInfo.move) : "—", cls });
        state = Chess.makeMove(state, played);
      }
      renderAnalysis(panel, rows, counts);
    }, 30);
  }
  function renderAnalysis(panel, rows, counts) {
    const sym = { bl: "??", mi: "?", in: "?!" }, lbl = { bl: "Σοβαρό λάθος", mi: "Λάθος", in: "Ανακρίβεια" };
    let html = `<div class="stats-box">`
      + `<span class="stat">⚪ <b>${counts.w.bl}</b>?? · <b>${counts.w.mi}</b>? · <b>${counts.w.in}</b>?!</span>`
      + `<span class="stat">⚫ <b>${counts.b.bl}</b>?? · <b>${counts.b.mi}</b>? · <b>${counts.b.in}</b>?!</span></div>`;
    if (!rows.length) html += "<div class='an-ok'>✓ Καμία σοβαρή αστοχία — καθαρή παρτίδα!</div>";
    else html += rows.map(r => {
      const who = r.side === "w" ? "⚪" : "⚫";
      return `<div class="hist-item an-${r.cls}"><span>${who} ${r.no}. <b>${r.san}${sym[r.cls]}</b></span><span class="det">Καλύτερο: <b>${r.bestSan}</b></span></div>`;
    }).join("");
    panel.innerHTML = html;
    // Συμβουλές βελτίωσης
    const tipEl = $("#chess-tips");
    if (tipEl) {
      const vs = $("#play-vs").checked, humanSide = vs ? $("#play-side").value : null;
      const block = (side, label) => `<div class="coach-tip"><b>🧭 Συμβουλές (${label}):</b><ul style="margin:6px 0 0;padding-left:18px">${chessTips(counts, side).map(x => `<li>${x}</li>`).join("")}</ul></div>`;
      tipEl.innerHTML = humanSide ? block(humanSide, "εσένα") : block("w", "⚪ Λευκά") + block("b", "⚫ Μαύρα");
    }
  }
  function chessTips(c, side) {
    const s = c[side] || { bl: 0, mi: 0, in: 0 }, t = [];
    if (s.bl >= 1) t.push("Είχες σοβαρά λάθη — πριν από ΚΑΘΕ κίνηση τσέκαρε αν αφήνεις κομμάτι ακάλυπτο (hanging).");
    if (s.mi >= 2) t.push("Αρκετά λάθη — ρώτα «τι απειλεί ο αντίπαλος;» πριν παίξεις.");
    if (s.in >= 3) t.push("Πολλές ανακρίβειες — δούλεψε βασικά τακτικά μοτίβα (πιρούνι, καρφί, σουβλιά).");
    if (s.bl + s.mi + s.in === 0) t.push("Καθαρή παρτίδα — καμία σοβαρή αστοχία! Συνέχισε έτσι.");
    t.push("Λύσε 5-10 ασκήσεις τακτικής κάθε μέρα (καρτέλα «Ασκήσεις»).");
    return t;
  }

  function newGame() {
    playMovesArr = [];
    chessRecorded = false;
    if ($("#chess-analysis")) $("#chess-analysis").innerHTML = "";
    if ($("#chess-tips")) $("#chess-tips").innerHTML = "";
    renderPlayMoves();
    playBoard.setFEN(Chess.START_FEN);
    const human = $("#play-side").value;
    playBoard.setFlipped(human === "b");
    updatePlayStatus();
    startClockGame();
    maybeAIMove();
    updateChessCoach();
  }
  function initPlay() {
    if (playBoard) return;
    playBoard = createBoard($("#play-board"), {
      onMove: (state, move, san, st) => {
        playMovesArr.push(san);
        renderPlayMoves();
        updatePlayStatus();
        const terminal = st === "checkmate" || st === "stalemate" || st === "draw50" || st === "insufficient";
        clockOnMove(state.turn, terminal);
        if (terminal) {
          if (st === "checkmate") recordChess(state.turn === "w" ? "b" : "w", "Ματ");
          else if (st === "stalemate") recordChess(null, "Πατ");
          else if (st === "draw50") recordChess(null, "Κανόνας 50 κινήσεων");
          else recordChess(null, "Ανεπαρκές υλικό");
        }
        maybeAIMove();
        updateChessCoach();
      },
    });
    $("#play-clock").addEventListener("change", newGame);
    $("#play-coach").addEventListener("change", updateChessCoach);
    $("#chess-analyze").addEventListener("click", analyzeChessGame);
    $("#chess-hist-clear").addEventListener("click", () => { histChess = []; saveH("chess", histChess); renderChessHistory(); });
    renderChessHistory();
    $("#play-new").addEventListener("click", newGame);
    $("#play-flip").addEventListener("click", () => playBoard.flip());
    $("#play-undo").addEventListener("click", () => {
      // αναίρεση: αν παίζει AI, κάνε 2 αναιρέσεις (δική μου + AI)
      const vs = $("#play-vs").checked;
      playBoard.undo(); playMovesArr.pop();
      if (vs && playBoard.canUndo()) { playBoard.undo(); playMovesArr.pop(); }
      renderPlayMoves(); updatePlayStatus();
    });
    $("#play-side").addEventListener("change", newGame);
    $("#play-vs").addEventListener("change", maybeAIMove);
    updatePlayStatus();
  }

  // ======================================================
  //  ΣΚΑΚΙ — Ανοίγματα
  // ======================================================
  let openBoard = null, openMoves = [], openPtr = 0, openCur = 0;
  function loadOpening(idx) {
    openCur = idx;
    const op = D.openings[idx];
    openMoves = op.moves.trim().split(/\s+/);
    openPtr = 0;
    openBoard.setFEN(Chess.START_FEN);
    $("#open-idea").innerHTML = "<b>Ιδέα:</b> " + op.idea;
    renderOpenMoves();
    $("#open-status").textContent = op.name + " — πάτα «Επόμενη»";
  }
  function renderOpenMoves() {
    let html = "";
    for (let i = 0; i < openMoves.length; i++) {
      if (i % 2 === 0) html += `<span class="num">${i / 2 + 1}.</span> `;
      const cls = i < openPtr ? "mv" : "mv"; // played vs pending
      const cur = i === openPtr ? " cur" : "";
      const played = i < openPtr;
      html += `<span class="${cls}${cur}" style="${played ? "" : "opacity:.5"}">${openMoves[i]}</span> `;
    }
    $("#open-moves").innerHTML = html;
  }
  function openNext() {
    if (openPtr >= openMoves.length) return;
    if (openBoard.moveBySAN(openMoves[openPtr])) {
      openPtr++;
      renderOpenMoves();
      if (openPtr >= openMoves.length) $("#open-status").textContent = D.openings[openCur].name + " — ολοκληρώθηκε ✔";
    }
  }
  function openReset() { loadOpening(openCur); }
  function initOpenings() {
    if (openBoard) return;
    openBoard = createBoard($("#open-board"), { interactive: false });
    const sel = $("#open-select");
    D.openings.forEach((op, i) => {
      const o = document.createElement("option"); o.value = i; o.textContent = op.name + " (" + op.eco + ")";
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => loadOpening(parseInt(sel.value, 10)));
    $("#open-next").addEventListener("click", openNext);
    $("#open-prev").addEventListener("click", openReset); // απλό reset (πίσω = ξανά από αρχή)
    $("#open-reset").addEventListener("click", openReset);
    loadOpening(0);
  }

  // ======================================================
  //  ΣΚΑΚΙ — Ασκήσεις (puzzles)
  // ======================================================
  let puzBoard = null, puzIdx = 0, puzSolved = 0, puzTried = new Set();
  function loadPuzzle(i) {
    const p = D.puzzles[i];
    puzIdx = i;
    $("#puz-title").textContent = `Άσκηση ${i + 1}/${D.puzzles.length}: ${p.theme}`;
    $("#puz-feedback").textContent = "Κάνε την κίνησή σου…";
    $("#puz-feedback").className = "status-line";
    $("#puz-lesson").style.display = "none";
    puzBoard.setFEN(p.fen);
    const turn = p.fen.split(" ")[1];
    puzBoard.setFlipped(turn === "b");
    updatePuzScore();
  }
  function updatePuzScore() { $("#puz-score").textContent = `Λυμένες: ${puzSolved}/${D.puzzles.length}`; }
  function puzOnMove(from, to) {
    const p = D.puzzles[puzIdx];
    const coord = Chess.sqName(from) + Chess.sqName(to);
    if (p.sol.includes(coord)) {
      // εκτέλεσε την κίνηση οπτικά
      const t = puzBoard.tryUserMove(from, to);
      if (t) puzBoard.forceMove(t.move);
      $("#puz-feedback").textContent = "✔ Σωστά! " + (p.answerSAN || "");
      $("#puz-feedback").className = "status-line win";
      $("#puz-lesson").innerHTML = "<b>Μάθημα:</b> " + p.lesson;
      $("#puz-lesson").style.display = "block";
      if (!puzTried.has(p.id)) { puzSolved++; puzTried.add(p.id); updatePuzScore(); markRoadmapAuto(); }
    } else {
      $("#puz-feedback").textContent = "✘ Όχι ακριβώς — δοκίμασε ξανά. (Βοήθεια αν κολλήσεις)";
      $("#puz-feedback").className = "status-line";
    }
  }
  function initPuzzles() {
    if (puzBoard) return;
    puzBoard = createBoard($("#puz-board"), {
      interactive: true, drag: true,
      onMove: (state, m) => {
        const p = D.puzzles[puzIdx];
        const coord = Chess.sqName(m.from) + Chess.sqName(m.to);
        if (p.sol.includes(coord)) {
          $("#puz-feedback").textContent = "✔ Σωστά! " + (p.answerSAN || "");
          $("#puz-feedback").className = "status-line win";
          $("#puz-lesson").innerHTML = "<b>Μάθημα:</b> " + p.lesson;
          $("#puz-lesson").style.display = "block";
          if (!puzTried.has(p.id)) { puzSolved++; puzTried.add(p.id); updatePuzScore(); }
        } else {
          // λάθος κίνηση: αναίρεση & ξαναπροσπάθησε
          setTimeout(() => puzBoard.undo(), 180);
          $("#puz-feedback").textContent = "✘ Όχι ακριβώς — δοκίμασε ξανά. (Βοήθεια αν κολλήσεις)";
          $("#puz-feedback").className = "status-line";
        }
      },
    });
    $("#puz-hint").addEventListener("click", () => {
      $("#puz-feedback").textContent = "💡 " + D.puzzles[puzIdx].hint;
      $("#puz-feedback").className = "status-line";
    });
    $("#puz-solve").addEventListener("click", () => {
      const p = D.puzzles[puzIdx];
      const [fs, ts] = [p.sol[0].slice(0, 2), p.sol[0].slice(2, 4)];
      const from = Chess.nameToIdx(fs), to = Chess.nameToIdx(ts);
      const t = puzBoard.tryUserMove(from, to);
      if (t) puzBoard.forceMove(t.move);
      $("#puz-feedback").textContent = "Λύση: " + (p.answerSAN || p.sol[0]);
      $("#puz-feedback").className = "status-line win";
      $("#puz-lesson").innerHTML = "<b>Μάθημα:</b> " + p.lesson;
      $("#puz-lesson").style.display = "block";
    });
    $("#puz-next").addEventListener("click", () => loadPuzzle((puzIdx + 1) % D.puzzles.length));
    loadPuzzle(0);
  }

  // ======================================================
  //  ΤΑΒΛΙ
  // ======================================================
  let tavli = null;

  // ---- Χρονόμετρο τάβλι ----
  const tclock = { enabled: false, base: 0, inc: 0, w: 0, b: 0, active: null, timer: null, last: 0, flagged: false };
  function trender() {
    const cw = $("#tclock-w"); if (!cw) return;
    $("#tclock-w-t").textContent = tclock.enabled ? fmtClock(tclock.w) : "--:--";
    $("#tclock-b-t").textContent = tclock.enabled ? fmtClock(tclock.b) : "--:--";
    cw.classList.toggle("active", tclock.active === "w");
    $("#tclock-b").classList.toggle("active", tclock.active === "b");
    cw.classList.toggle("low", tclock.enabled && tclock.w < 20);
    $("#tclock-b").classList.toggle("low", tclock.enabled && tclock.b < 20);
  }
  function tstop() { if (tclock.timer) { clearInterval(tclock.timer); tclock.timer = null; } tclock.active = null; trender(); }
  function ttick() {
    if (!tclock.timer) return;
    const now = performance.now(), dt = (now - tclock.last) / 1000; tclock.last = now;
    if (tclock.active && !tclock.flagged) { tclock[tclock.active] -= dt; if (tclock[tclock.active] <= 0) { tclock[tclock.active] = 0; tflag(tclock.active); return; } }
    trender();
  }
  function trun(side) { tclock.active = side; tclock.last = performance.now(); if (!tclock.timer) tclock.timer = setInterval(ttick, 100); trender(); }
  function tflag(side) {
    tstop(); tclock.flagged = true;
    $("#tclock-" + side).classList.add("flag");
    if (tavli) tavli.setLocked(true);
    $("#tavli-info").textContent = `⏱️ ${side === "w" ? "Λευκά" : "Μαύρα"} έχασαν στον χρόνο — νίκη ${side === "w" ? "Μαύρων" : "Λευκών"}! 🏆`;
  }
  function tapplySelect() {
    const tc = parseTC($("#tavli-clock").value);
    if (!tc) { tclock.enabled = false; tstop(); if ($("#tavli-clocks")) $("#tavli-clocks").style.display = "none"; return; }
    tclock.enabled = true; tclock.base = tc.base; tclock.inc = tc.inc;
  }
  function tclockOnTurn(turnC, prevC) {
    if (!tclock.enabled) { if ($("#tavli-clocks")) $("#tavli-clocks").style.display = "none"; return; }
    $("#tavli-clocks").style.display = "flex";
    if (prevC === null) {
      tclock.flagged = false; $("#tclock-w").classList.remove("flag"); $("#tclock-b").classList.remove("flag");
      tclock.w = tclock.base; tclock.b = tclock.base; trun(turnC); return;
    }
    if (tclock.flagged) return;
    tclock[prevC] += tclock.inc;
    trun(turnC);
  }

  function renderCubePanel(c) {
    if (!$("#tavli-cube-val")) return;
    $("#tavli-cube-val").textContent = "×" + c.value;
    $("#tavli-cube-owner").textContent = c.owner ? "(" + (c.owner === "w" ? "Λευκά" : "Μαύρα") + ")" : "(στο κέντρο)";
    $("#tavli-score").textContent = `Ματς: ⚪ ${c.scoreW} – ${c.scoreB} ⚫ (έως ${c.target})`;
    const act = $("#tavli-cube-actions"); act.innerHTML = "";
    if (c.awaitingHuman) {
      const t = document.createElement("button"); t.className = "btn gold"; t.textContent = "✔ Δέχομαι ×" + c.proposed;
      t.onclick = () => tavli.respond(true);
      const p = document.createElement("button"); p.className = "btn"; p.textContent = "✖ Παρατάω";
      p.onclick = () => tavli.respond(false);
      act.appendChild(t); act.appendChild(p);
    } else if (c.canDouble) {
      const d = document.createElement("button"); d.className = "btn primary"; d.textContent = "⧉ Διπλασιασμός ×" + c.proposed;
      d.onclick = () => tavli.double();
      act.appendChild(d);
    }
  }

  function initTavli() {
    if (tavli) return;
    tavli = createTavli($("#tavli-board"), {
      variant: $("#tavli-variant").value,
      target: parseInt($("#tavli-target").value, 10),
      onInfo: (msg) => { $("#tavli-info").textContent = msg; },
      onTurn: (turnC, prevC) => tclockOnTurn(turnC, prevC),
      onWin: () => tstop(),
      onCube: renderCubePanel,
      onGameResult: recordTavli,
      coach: $("#tavli-coach").checked,
      onCoach: (txt) => { const el = $("#tavli-coach-tip"); if (el) el.innerHTML = txt ? ("💡 " + txt) : ""; },
      onPips: (w, b, turn) => {
        const diff = Math.abs(w - b);
        const lead = w < b ? "Λευκά" : "Μαύρα";
        $("#tavli-pip").innerHTML =
          `<span class="pip-w${turn === "w" ? " act" : ""}">⚪ Λευκά: <b>${w}</b></span>` +
          `<span class="pip-b${turn === "b" ? " act" : ""}">⚫ Μαύρα: <b>${b}</b></span>` +
          `<span class="pip-lead">${diff === 0 ? "🏁 Ισοπαλία στην κούρσα" : "🏁 Προηγείται " + lead + " κατά " + diff + " pips"}</span>`;
      },
    });
    $("#tavli-variant").addEventListener("change", () => tavli.setVariant($("#tavli-variant").value));
    $("#tavli-reset").addEventListener("click", () => tavli.reset());
    $("#tavli-bearoff").addEventListener("click", () => tavli.bearOff());
    $("#tavli-vs").addEventListener("change", () => tavli.setVs($("#tavli-vs").checked));
    $("#tavli-target").addEventListener("change", () => tavli.newMatch(parseInt($("#tavli-target").value, 10)));
    $("#tavli-newmatch").addEventListener("click", () => tavli.newMatch(parseInt($("#tavli-target").value, 10)));
    $("#tavli-aiside").addEventListener("change", () => { if ($("#tavli-vs").checked) tavli.setAiSide($("#tavli-aiside").value); });
    tavli.setAiLevel(parseInt($("#tavli-ailevel").value, 10));
    $("#tavli-ailevel").addEventListener("change", () => tavli.setAiLevel(parseInt($("#tavli-ailevel").value, 10)));
    $("#tavli-clock").addEventListener("change", () => { tapplySelect(); tavli.reset(); });
    $("#tavli-hist-clear").addEventListener("click", () => { histTavli = []; saveH("tavli", histTavli); renderTavliHistory(); });
    $("#tavli-coach").addEventListener("change", () => tavli.setCoach($("#tavli-coach").checked));
    $("#tavli-summary-btn").addEventListener("click", () => renderTavliSummary(tavli.getSummary()));
    renderTavliHistory();
  }

  // Κανόνες τάβλι (cards)
  function buildTavliRules() {
    const wrap = $("#tavli-rules-cards");
    Object.values(D.tavliVariants).forEach(v => {
      const c = document.createElement("div");
      c.className = "card";
      c.innerHTML = `<h2>${v.name} <small style="color:var(--muted);font-weight:400">— ${v.subtitle}</small></h2>
        <ul class="clean">${v.rules.map(r => `<li>${r}</li>`).join("")}</ul>`;
      wrap.appendChild(c);
    });
    if (D.otherVariants) {
      const c = document.createElement("div"); c.className = "card";
      c.innerHTML = `<h2>🔎 Άλλες παραλλαγές τάβλι από τον κόσμο</h2>
        <p style="color:var(--muted)">Πέρα από τα βασικά, υπάρχουν κι άλλες παραλλαγές που αξίζει να γνωρίζεις:</p>` +
        D.otherVariants.map(([n, d]) => `<details><summary>${n}</summary><p>${d}</p></details>`).join("");
      wrap.appendChild(c);
    }
  }
  function buildTavliStrat() {
    const wrap = $("#tavli-strat-cards");
    Object.values(D.tavliVariants).forEach(v => {
      const c = document.createElement("div");
      c.className = "card";
      c.innerHTML = `<h2>${v.name} — στρατηγική</h2>
        <ul class="clean">${v.strategy.map(r => `<li>${r}</li>`).join("")}</ul>`;
      wrap.appendChild(c);
    });
  }
  function buildTavliOpenings() {
    const t = $("#tavli-open-table");
    t.innerHTML = "<tr><th>Ζαριά</th><th>Καλύτερη κίνηση</th><th>Σχόλιο</th></tr>" +
      D.tavliOpenings.map(o => `<tr><td><b>${o.roll}</b></td><td>${o.play}</td><td>${o.note}</td></tr>`).join("");
  }
  function buildOdds() {
    const t = $("#odds-table");
    t.innerHTML = "<tr><th>Απόσταση</th><th>Τρόποι /36</th><th>Πιθανότητα</th></tr>" +
      D.hitOdds.map(o => `<tr><td>${o.d}</td><td>${o.ways}</td><td>${(o.ways / 36 * 100).toFixed(1)}%</td></tr>`).join("");
    const sel = $("#odds-dist");
    D.hitOdds.forEach(o => { const op = document.createElement("option"); op.value = o.ways; op.textContent = o.d; op.dataset.d = o.d; sel.appendChild(op); });
    function upd() {
      const opt = sel.options[sel.selectedIndex];
      const ways = parseInt(sel.value, 10), d = opt.dataset.d;
      $("#odds-result").innerHTML = `Απόσταση <b>${d}</b>: <b>${ways}</b> στους 36 → <b>${(ways / 36 * 100).toFixed(1)}%</b> πιθανότητα χτυπήματος.`;
    }
    sel.addEventListener("change", upd);
    sel.selectedIndex = 5; upd();
  }

  // ======================================================
  //  ROADMAP + πρόοδος (localStorage)
  // ======================================================
  const LS_KEY = "skakitavli_progress_v1";
  let progress = {};
  function loadProgress() { try { progress = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { progress = {}; } }
  function saveProgress() { try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch (e) {} }
  function allSteps() {
    let n = 0; D.roadmap.forEach(p => n += p.steps.length); return n;
  }
  function doneCount() { return Object.values(progress).filter(Boolean).length; }
  function updateProgressBars() {
    const total = allSteps(), done = doneCount();
    const pct = total ? Math.round(done / total * 100) : 0;
    ["#road-progress", "#home-progress"].forEach(s => { const el = $(s); if (el) el.style.width = pct + "%"; });
    const txt = `${done} / ${total} βήματα ολοκληρωμένα (${pct}%)`;
    const rt = $("#road-progress-text"); if (rt) rt.textContent = txt;
    const ht = $("#home-progress-text"); if (ht) ht.textContent = pct === 0 ? "Ξεκίνα το ταξίδι σου — τσέκαρε το πρώτο βήμα!" : txt;
  }
  function buildRoadmap() {
    const wrap = $("#roadmap-phases");
    let gi = 0;
    D.roadmap.forEach((ph, pi) => {
      const card = document.createElement("div");
      card.className = "card";
      let html = `<h2 style="color:${ph.color}">${ph.phase}</h2>`;
      ph.steps.forEach((s) => {
        const key = "s_" + pi + "_" + gi;
        const checked = progress[key] ? "checked" : "";
        html += `<div class="roadmap-step">
          <label class="ck" style="margin:0;align-items:flex-start">
            <input type="checkbox" data-key="${key}" ${checked}>
            <span style="color:var(--text)">${s}</span>
          </label></div>`;
        gi++;
      });
      card.innerHTML = html;
      wrap.appendChild(card);
    });
    $$("#roadmap-phases input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        progress[cb.dataset.key] = cb.checked;
        saveProgress(); updateProgressBars();
      });
    });
  }
  function markRoadmapAuto() { /* θέση για μελλοντική αυτόματη σήμανση από επιτεύγματα */ }
  $("#road-reset").addEventListener("click", () => {
    if (confirm("Σίγουρα θέλεις να μηδενίσεις όλη την πρόοδο;")) {
      progress = {}; saveProgress();
      $$("#roadmap-phases input[type=checkbox]").forEach(cb => cb.checked = false);
      updateProgressBars();
    }
  });

  // ======================================================
  //  ΓΛΩΣΣΑΡΙ
  // ======================================================
  function buildGlossary() {
    const wrap = $("#glossary-content");
    Object.entries(D.glossary).forEach(([cat, items]) => {
      const c = document.createElement("div");
      c.className = "card";
      c.innerHTML = `<h2>${cat}</h2>` + items.map(([term, def]) =>
        `<details><summary>${term}</summary><p>${def}</p></details>`).join("");
      wrap.appendChild(c);
    });
  }

  // ======================================================
  //  DOUBLING CUBE TRAINER
  // ======================================================
  let dcIdx = -1, dcScore = 0, dcAnswered = false;
  const cubeVals = [2, 4, 8, 16, 4, 2, 8, 4];
  function updateDCScore() { $("#dc-score").textContent = `Σκορ: ${dcScore}`; }
  function loadDC() {
    dcAnswered = false;
    dcIdx = (dcIdx + 1) % D.doubling.length;
    const s = D.doubling[dcIdx];
    $("#dc-cube").textContent = cubeVals[dcIdx % cubeVals.length];
    $("#dc-scenario").textContent = s.q;
    $("#dc-feedback").style.display = "none";
    const ch = $("#dc-choices"); ch.innerHTML = "";
    const opts = s.type === "double"
      ? [["yes", "✔ Διπλασιάζω"], ["no", "✖ Δεν διπλασιάζω"]]
      : [["take", "✔ Take (δέχομαι)"], ["pass", "✖ Pass (παρατάω)"]];
    opts.forEach(([val, label]) => {
      const b = document.createElement("button"); b.className = "btn"; b.textContent = label;
      b.onclick = () => answerDC(val); ch.appendChild(b);
    });
    updateDCScore();
  }
  function answerDC(val) {
    if (dcAnswered) return; dcAnswered = true;
    const s = D.doubling[dcIdx];
    const correct = val === s.answer;
    if (correct) dcScore++;
    const fb = $("#dc-feedback");
    fb.style.display = "block";
    fb.className = "callout dc-feedback" + (correct ? "" : " red");
    fb.innerHTML = `<b class="${correct ? "dc-correct" : "dc-wrong"}">${correct ? "✔ Σωστά!" : "✘ Λάθος."}</b> ${s.reason}`;
    updateDCScore();
  }
  function initDoubling() {
    if (initDoubling._done) return; initDoubling._done = true;
    $("#dc-next").addEventListener("click", loadDC);
    loadDC();
  }

  // ======================================================
  //  ΕΜΦΑΝΙΣΗ (θέματα, 3D, ήχος) — localStorage
  // ======================================================
  const APP_KEY = "skakitavli_appearance_v1";
  function loadAppearance() { try { return JSON.parse(localStorage.getItem(APP_KEY)) || {}; } catch (e) { return {}; } }
  function saveAppearance(a) { try { localStorage.setItem(APP_KEY, JSON.stringify(a)); } catch (e) {} }
  function redrawBoards() { [playBoard, openBoard, puzBoard].forEach(b => b && b.redraw && b.redraw()); }
  function setupAppearance() {
    const a = Object.assign({
      board: "wood", accent: "amber", piece3d: true, view3d: false,
      pieces: "classic", pstyle: "staunton", checkers: "classic",
    }, loadAppearance());
    const apply = () => {
      document.body.dataset.board = a.board;
      document.body.dataset.accent = a.accent;
      document.body.dataset.piece3d = a.piece3d ? "on" : "off";
      document.body.dataset.view3d = a.view3d ? "on" : "off";
      document.body.dataset.pieces = a.pieces;
      document.body.dataset.pieceStyle = a.pstyle;
      document.body.dataset.checkers = a.checkers;
      saveAppearance(a);
    };
    // init controls
    $("#set-board").value = a.board;
    $("#set-accent").value = a.accent;
    $("#set-3d").checked = a.piece3d;
    $("#set-view3d").checked = a.view3d;
    $("#set-pieces").value = a.pieces;
    $("#set-pstyle").value = a.pstyle;
    $("#set-checkers").value = a.checkers;
    apply();
    $("#set-board").addEventListener("change", e => { a.board = e.target.value; apply(); });
    $("#set-accent").addEventListener("change", e => { a.accent = e.target.value; apply(); });
    $("#set-3d").addEventListener("change", e => { a.piece3d = e.target.checked; apply(); });
    $("#set-view3d").addEventListener("change", e => { a.view3d = e.target.checked; apply(); });
    $("#set-pieces").addEventListener("change", e => { a.pieces = e.target.value; apply(); });
    $("#set-pstyle").addEventListener("change", e => { a.pstyle = e.target.value; apply(); redrawBoards(); });
    $("#set-checkers").addEventListener("change", e => { a.checkers = e.target.value; apply(); });
    // ήχος
    const mb = $("#set-mute");
    const syncMute = () => {
      const on = !(window.SFX && SFX.muted);
      mb.classList.toggle("on", on);
      mb.textContent = on ? "🔊 Ήχος" : "🔇 Σίγαση";
    };
    syncMute();
    mb.addEventListener("click", () => { if (window.SFX) { SFX.setMuted(!SFX.muted); if (!SFX.muted) SFX.dice(); } syncMute(); });
  }

  // Λειτουργία εστίασης (board πρωταγωνιστής) — θυμάται την κατάσταση
  const FOCUS_KEY = "skakitavli_focus_v1";
  function setFocus(on) {
    document.body.dataset.focus = on ? "on" : "off";
    $("#focus-toggle").textContent = on ? "✕ Έξοδος" : "⛶ Εστίαση";
    try { localStorage.setItem(FOCUS_KEY, on ? "1" : "0"); } catch (e) {}
  }
  $("#focus-toggle").addEventListener("click", () => {
    setFocus(document.body.dataset.focus !== "on");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  try { if (localStorage.getItem(FOCUS_KEY) === "1") setFocus(true); } catch (e) {}

  // ---------------- INIT ----------------
  setupAppearance();
  loadProgress();
  buildTavliRules();
  buildTavliStrat();
  buildTavliOpenings();
  buildOdds();
  buildRoadmap();
  buildGlossary();
  updateProgressBars();
})();
