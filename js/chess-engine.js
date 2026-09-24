/* ============================================================
   ΣΚΑΚΙ & ΤΑΒΛΙ 360° — Μηχανή Σκακιού (chess-engine.js)
   Πλήρης, αυτόνομη μηχανή σκακιού σε καθαρή JavaScript.
   - Νόμιμες κινήσεις (ροκέ, en passant, προαγωγή)
   - Ανίχνευση σαχ / ματ / πατ / ισοπαλίας
   - Απλός AI αντίπαλος (minimax + alpha-beta)
   Αναπαράσταση: πίνακας 64 θέσεων. r=0 => 8η οριζόντια (πάνω/μαύρα),
   r=7 => 1η οριζόντια (κάτω/λευκά). c=0 => στήλη 'a'.
   ============================================================ */
(function (global) {
  "use strict";

  const FILES = "abcdefgh";
  const START_FEN =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  function idx(r, c) { return r * 8 + c; }
  function rc(i) { return [Math.floor(i / 8), i % 8]; }
  function inside(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function sqName(i) { const [r, c] = rc(i); return FILES[c] + (8 - r); }
  function nameToIdx(s) { const c = FILES.indexOf(s[0]); const r = 8 - parseInt(s[1], 10); return idx(r, c); }

  // ---- Δημιουργία κατάστασης από FEN ----
  function fromFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    const board = new Array(64).fill(null);
    let r = 0, c = 0;
    for (const ch of parts[0]) {
      if (ch === "/") { r++; c = 0; }
      else if (/\d/.test(ch)) { c += parseInt(ch, 10); }
      else {
        const color = ch === ch.toUpperCase() ? "w" : "b";
        board[idx(r, c)] = { t: ch.toLowerCase(), c: color };
        c++;
      }
    }
    const turn = parts[1] || "w";
    const cr = parts[2] || "-";
    const castling = {
      wK: cr.includes("K"), wQ: cr.includes("Q"),
      bK: cr.includes("k"), bQ: cr.includes("q"),
    };
    const ep = (parts[3] && parts[3] !== "-") ? nameToIdx(parts[3]) : null;
    return {
      board, turn, castling, ep,
      half: parseInt(parts[4] || "0", 10),
      full: parseInt(parts[5] || "1", 10),
    };
  }

  function clone(state) {
    return {
      board: state.board.map(p => (p ? { t: p.t, c: p.c } : null)),
      turn: state.turn,
      castling: Object.assign({}, state.castling),
      ep: state.ep,
      half: state.half,
      full: state.full,
    };
  }

  function toFEN(state) {
    let rows = [];
    for (let r = 0; r < 8; r++) {
      let row = "", empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = state.board[idx(r, c)];
        if (!p) { empty++; }
        else {
          if (empty) { row += empty; empty = 0; }
          let ch = p.t;
          row += p.c === "w" ? ch.toUpperCase() : ch;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    let cr = "";
    if (state.castling.wK) cr += "K";
    if (state.castling.wQ) cr += "Q";
    if (state.castling.bK) cr += "k";
    if (state.castling.bQ) cr += "q";
    if (!cr) cr = "-";
    const ep = state.ep != null ? sqName(state.ep) : "-";
    return `${rows.join("/")} ${state.turn} ${cr} ${ep} ${state.half} ${state.full}`;
  }

  const KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const KING = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const BISHOP = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const ROOK = [[-1,0],[1,0],[0,-1],[0,1]];

  function opp(color) { return color === "w" ? "b" : "w"; }

  // Ελέγχει αν το τετράγωνο (r,c) απειλείται από το χρώμα "by".
  function attacked(board, r, c, by) {
    // Πιόνια
    const pd = by === "w" ? 1 : -1; // πιόνια του "by" απειλούν προς τα εδώ
    for (const dc of [-1, 1]) {
      const pr = r + pd, pcc = c + dc;
      if (inside(pr, pcc)) {
        const p = board[idx(pr, pcc)];
        if (p && p.c === by && p.t === "p") return true;
      }
    }
    // Ίππος
    for (const [dr, dc] of KNIGHT) {
      const nr = r + dr, nc = c + dc;
      if (inside(nr, nc)) {
        const p = board[idx(nr, nc)];
        if (p && p.c === by && p.t === "n") return true;
      }
    }
    // Βασιλιάς
    for (const [dr, dc] of KING) {
      const nr = r + dr, nc = c + dc;
      if (inside(nr, nc)) {
        const p = board[idx(nr, nc)];
        if (p && p.c === by && p.t === "k") return true;
      }
    }
    // Αξιωματικός / Βασίλισσα (διαγώνια)
    for (const [dr, dc] of BISHOP) {
      let nr = r + dr, nc = c + dc;
      while (inside(nr, nc)) {
        const p = board[idx(nr, nc)];
        if (p) { if (p.c === by && (p.t === "b" || p.t === "q")) return true; break; }
        nr += dr; nc += dc;
      }
    }
    // Πύργος / Βασίλισσα (ευθεία)
    for (const [dr, dc] of ROOK) {
      let nr = r + dr, nc = c + dc;
      while (inside(nr, nc)) {
        const p = board[idx(nr, nc)];
        if (p) { if (p.c === by && (p.t === "r" || p.t === "q")) return true; break; }
        nr += dr; nc += dc;
      }
    }
    return false;
  }

  function findKing(board, color) {
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && p.t === "k" && p.c === color) return i;
    }
    return -1;
  }

  function inCheck(state, color) {
    const k = findKing(state.board, color);
    if (k < 0) return false;
    const [r, c] = rc(k);
    return attacked(state.board, r, c, opp(color));
  }

  // ---- Ψευδο-νόμιμες κινήσεις για μία θέση ----
  function pseudoMoves(state) {
    const moves = [];
    const b = state.board;
    const me = state.turn;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || p.c !== me) continue;
      const [r, c] = rc(i);
      if (p.t === "p") {
        const dir = me === "w" ? -1 : 1;
        const startRow = me === "w" ? 6 : 1;
        const promoRow = me === "w" ? 0 : 7;
        // εμπρός
        if (inside(r + dir, c) && !b[idx(r + dir, c)]) {
          addPawn(moves, i, idx(r + dir, c), r + dir === promoRow);
          if (r === startRow && !b[idx(r + 2 * dir, c)]) {
            moves.push({ from: i, to: idx(r + 2 * dir, c), dbl: true });
          }
        }
        // αιχμαλωσίες
        for (const dc of [-1, 1]) {
          const nr = r + dir, nc = c + dc;
          if (!inside(nr, nc)) continue;
          const t = b[idx(nr, nc)];
          if (t && t.c !== me) addPawn(moves, i, idx(nr, nc), nr === promoRow, true);
          else if (state.ep === idx(nr, nc)) moves.push({ from: i, to: idx(nr, nc), ep: true });
        }
      } else if (p.t === "n") {
        for (const [dr, dc] of KNIGHT) {
          const nr = r + dr, nc = c + dc;
          if (!inside(nr, nc)) continue;
          const t = b[idx(nr, nc)];
          if (!t || t.c !== me) moves.push({ from: i, to: idx(nr, nc) });
        }
      } else if (p.t === "k") {
        for (const [dr, dc] of KING) {
          const nr = r + dr, nc = c + dc;
          if (!inside(nr, nc)) continue;
          const t = b[idx(nr, nc)];
          if (!t || t.c !== me) moves.push({ from: i, to: idx(nr, nc) });
        }
        // Ροκέ
        addCastling(state, moves, i, me);
      } else {
        const dirs = p.t === "b" ? BISHOP : p.t === "r" ? ROOK : BISHOP.concat(ROOK);
        for (const [dr, dc] of dirs) {
          let nr = r + dr, nc = c + dc;
          while (inside(nr, nc)) {
            const t = b[idx(nr, nc)];
            if (!t) moves.push({ from: i, to: idx(nr, nc) });
            else { if (t.c !== me) moves.push({ from: i, to: idx(nr, nc) }); break; }
            nr += dr; nc += dc;
          }
        }
      }
    }
    return moves;
  }

  function addPawn(moves, from, to, promo, cap) {
    if (promo) {
      for (const pr of ["q", "r", "b", "n"]) moves.push({ from, to, promo: pr, cap: !!cap });
    } else {
      moves.push({ from, to, cap: !!cap });
    }
  }

  function addCastling(state, moves, kingIdx, me) {
    const b = state.board;
    const row = me === "w" ? 7 : 0;
    if (kingIdx !== idx(row, 4)) return;
    if (inCheck(state, me)) return;
    const enemy = opp(me);
    // Βασιλική πλευρά (short)
    const kside = me === "w" ? state.castling.wK : state.castling.bK;
    if (kside && !b[idx(row, 5)] && !b[idx(row, 6)] &&
        b[idx(row, 7)] && b[idx(row, 7)].t === "r" && b[idx(row, 7)].c === me &&
        !attacked(b, row, 5, enemy) && !attacked(b, row, 6, enemy)) {
      moves.push({ from: kingIdx, to: idx(row, 6), castle: "K" });
    }
    // Βασιλισσίστικη πλευρά (long)
    const qside = me === "w" ? state.castling.wQ : state.castling.bQ;
    if (qside && !b[idx(row, 3)] && !b[idx(row, 2)] && !b[idx(row, 1)] &&
        b[idx(row, 0)] && b[idx(row, 0)].t === "r" && b[idx(row, 0)].c === me &&
        !attacked(b, row, 3, enemy) && !attacked(b, row, 2, enemy)) {
      moves.push({ from: kingIdx, to: idx(row, 2), castle: "Q" });
    }
  }

  // ---- Εκτέλεση κίνησης (επιστρέφει ΝΕΑ κατάσταση) ----
  function makeMove(state, m) {
    const captured = m.ep || !!state.board[m.to];
    const s = clone(state);
    const b = s.board;
    const p = b[m.from];
    const me = p.c;
    s.ep = null;

    // en passant αιχμαλωσία
    if (m.ep) {
      const [tr, tc] = rc(m.to);
      const capRow = me === "w" ? tr + 1 : tr - 1;
      b[idx(capRow, tc)] = null;
    }
    // ροκέ: μετακίνηση πύργου
    if (m.castle) {
      const [kr] = rc(m.from);
      if (m.castle === "K") { b[idx(kr, 5)] = b[idx(kr, 7)]; b[idx(kr, 7)] = null; }
      else { b[idx(kr, 3)] = b[idx(kr, 0)]; b[idx(kr, 0)] = null; }
    }

    b[m.to] = m.promo ? { t: m.promo, c: me } : p;
    b[m.from] = null;

    // διπλό βήμα πιονιού -> ep target
    if (m.dbl) {
      const [fr, fc] = rc(m.from);
      s.ep = idx((fr + rc(m.to)[0]) / 2, fc);
    }

    // δικαιώματα ροκέ
    if (p.t === "k") {
      if (me === "w") { s.castling.wK = false; s.castling.wQ = false; }
      else { s.castling.bK = false; s.castling.bQ = false; }
    }
    const touch = (i) => {
      if (i === idx(7, 0)) s.castling.wQ = false;
      if (i === idx(7, 7)) s.castling.wK = false;
      if (i === idx(0, 0)) s.castling.bQ = false;
      if (i === idx(0, 7)) s.castling.bK = false;
    };
    touch(m.from); touch(m.to);

    // ημι-κινήσεις (κανόνας 50 κινήσεων)
    if (p.t === "p" || captured) s.half = 0; else s.half = state.half + 1;
    if (me === "b") s.full = state.full + 1;
    s.turn = opp(me);
    return s;
  }

  // ---- Νόμιμες κινήσεις (φιλτράρισμα με έλεγχο σαχ) ----
  function legalMoves(state) {
    const res = [];
    for (const m of pseudoMoves(state)) {
      const s2 = makeMove(state, m);
      if (!inCheck(s2, state.turn)) res.push(m);
    }
    return res;
  }

  function movesFrom(state, from) {
    return legalMoves(state).filter(m => m.from === from);
  }

  function status(state) {
    const legal = legalMoves(state);
    const chk = inCheck(state, state.turn);
    if (legal.length === 0) {
      return chk ? "checkmate" : "stalemate";
    }
    if (state.half >= 100) return "draw50";
    if (insufficientMaterial(state)) return "insufficient";
    return chk ? "check" : "ongoing";
  }

  function insufficientMaterial(state) {
    const pieces = state.board.filter(Boolean);
    const nonKing = pieces.filter(p => p.t !== "k");
    if (nonKing.length === 0) return true;
    if (nonKing.length === 1 && (nonKing[0].t === "b" || nonKing[0].t === "n")) return true;
    if (nonKing.length === 2 && nonKing.every(p => p.t === "b")) {
      // K+B vs K+B ίδιου χρώματος τετραγώνου = ισοπαλία (απλοποίηση)
      return true;
    }
    return false;
  }

  // ---- Αλγεβρική σημειογραφία (SAN) ----
  function toSAN(state, m) {
    if (m.castle === "K") return decorate(state, m, "O-O");
    if (m.castle === "Q") return decorate(state, m, "O-O-O");
    const p = state.board[m.from];
    const dest = sqName(m.to);
    const cap = m.ep || !!state.board[m.to];
    let san = "";
    if (p.t === "p") {
      if (cap) san = FILES[rc(m.from)[1]] + "x" + dest;
      else san = dest;
      if (m.promo) san += "=" + m.promo.toUpperCase();
    } else {
      san = p.t.toUpperCase();
      // αποσαφήνιση
      const others = legalMoves(state).filter(
        o => o.to === m.to && o.from !== m.from &&
        state.board[o.from] && state.board[o.from].t === p.t
      );
      if (others.length) {
        const [fr, fc] = rc(m.from);
        const sameFile = others.some(o => rc(o.from)[1] === fc);
        const sameRank = others.some(o => rc(o.from)[0] === fr);
        if (!sameFile) san += FILES[fc];
        else if (!sameRank) san += (8 - fr);
        else san += FILES[fc] + (8 - fr);
      }
      if (cap) san += "x";
      san += dest;
    }
    return decorate(state, m, san);
  }

  function decorate(state, m, san) {
    const s2 = makeMove(state, m);
    const st = status(s2);
    if (st === "checkmate") return san + "#";
    if (st === "check") return san + "+";
    return san;
  }

  // ==================== AI ====================
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  // Πίνακες θέσης (από λευκή οπτική, r=0 πάνω). Απλοποιημένοι.
  const PST = {
    p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
        5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
        5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
        -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
        -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
        -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10,
        -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
        -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
        -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10,
        -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
        0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10,
        -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
        20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  };

  function evaluate(state) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = state.board[i];
      if (!p) continue;
      const base = VALUE[p.t];
      const pst = PST[p.t][p.c === "w" ? i : (63 - i)];
      const val = base + pst;
      score += p.c === "w" ? val : -val;
    }
    return score; // θετικό = καλό για λευκά
  }

  function orderMoves(state, moves) {
    // Πρώτα αιχμαλωσίες (MVV-LVA χοντρικά)
    return moves.slice().sort((a, b) => scoreMove(state, b) - scoreMove(state, a));
  }
  function scoreMove(state, m) {
    let s = 0;
    const victim = state.board[m.to];
    if (victim) s += 10 * VALUE[victim.t] - VALUE[state.board[m.from].t];
    if (m.promo) s += VALUE[m.promo];
    return s;
  }

  function negamax(state, depth, alpha, beta, colorSign) {
    const st = status(state);
    if (st === "checkmate") return -100000 - depth; // ματ: όσο πιο κοντά τόσο χειρότερο για αυτόν που κινείται
    if (st === "stalemate" || st === "draw50" || st === "insufficient") return 0;
    if (depth === 0) return colorSign * evaluate(state);

    let best = -Infinity;
    const moves = orderMoves(state, legalMoves(state));
    for (const m of moves) {
      const val = -negamax(makeMove(state, m), depth - 1, -beta, -alpha, -colorSign);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Επιστρέφει την καλύτερη κίνηση για τον παίκτη που κινείται.
  function bestMove(state, depth) {
    depth = depth || 2;
    const colorSign = state.turn === "w" ? 1 : -1;
    let best = null, bestVal = -Infinity;
    const moves = orderMoves(state, legalMoves(state));
    for (const m of moves) {
      const val = -negamax(makeMove(state, m), depth - 1, -Infinity, Infinity, -colorSign);
      // μικρή τυχαιότητα για ποικιλία σε ισοδύναμες
      const jitter = Math.random() * 8;
      if (val + jitter > bestVal) { bestVal = val + jitter; best = m; }
    }
    return best;
  }

  // Αξιολόγηση για την πλευρά που κινείται (για ανάλυση παρτίδας)
  function evalForMover(state, depth) {
    const colorSign = state.turn === "w" ? 1 : -1;
    let best = -Infinity, bm = null;
    for (const m of orderMoves(state, legalMoves(state))) {
      const val = -negamax(makeMove(state, m), depth - 1, -Infinity, Infinity, -colorSign);
      if (val > best) { best = val; bm = m; }
    }
    return { best, move: bm };
  }
  function scoreOfMove(state, move, depth) {
    const colorSign = state.turn === "w" ? 1 : -1;
    return -negamax(makeMove(state, move), depth - 1, -Infinity, Infinity, -colorSign);
  }

  global.Chess = {
    START_FEN, fromFEN, toFEN, clone, legalMoves, movesFrom, makeMove,
    status, inCheck, toSAN, sqName, nameToIdx, idx, rc, bestMove, evaluate, findKing,
    evalForMover, scoreOfMove,
  };
})(window);
