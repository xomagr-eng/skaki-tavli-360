/* ΣΚΑΚΙ & ΤΑΒΛΙ 360° — chess-ui.js
   Επαναχρησιμοποιήσιμος renderer διαδραστικής σκακιέρας. */
(function (global) {
  "use strict";
  const G = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  };
  const FILES = "abcdefgh";

  function createBoard(container, opts) {
    opts = opts || {};
    let state = Chess.fromFEN(opts.fen || Chess.START_FEN);
    let flipped = !!opts.flipped;
    let interactive = opts.interactive !== false;
    let selected = null;
    let lastMove = null;
    let history = [];
    let pendingPromo = null; // {from,to,options}
    let dragging = null;     // {from, ghost, moved}
    let hint = null;         // {from, to} προπονητής
    const enableDrag = opts.drag !== false;
    const onMove = opts.onMove || function () {};
    const onEnd = opts.onEnd || function () {};

    const board = document.createElement("div");
    board.className = "chessboard";
    container.innerHTML = "";
    container.appendChild(board);

    function legalFrom(i) { return interactive ? Chess.movesFrom(state, i) : []; }

    function redraw() {
      board.innerHTML = "";
      const kInCheck = Chess.inCheck(state, state.turn)
        ? Chess.findKing(state.board, state.turn) : -1;
      const sel = selected;
      const dests = sel != null ? legalFrom(sel).map(m => m.to) : [];
      for (let dr = 0; dr < 8; dr++) {
        for (let dc = 0; dc < 8; dc++) {
          const r = flipped ? 7 - dr : dr;
          const c = flipped ? 7 - dc : dc;
          const i = r * 8 + c;
          const sq = document.createElement("div");
          sq.className = "sq " + ((r + c) % 2 === 0 ? "light" : "dark");
          sq.dataset.i = i;
          if (sel === i) sq.classList.add("sel");
          if (lastMove && (lastMove.from === i || lastMove.to === i)) sq.classList.add("lastmove");
          if (hint && (hint.from === i || hint.to === i)) sq.classList.add("hint");
          if (i === kInCheck) { sq.classList.add("check"); const km = document.createElement("div"); km.className = "kmark"; sq.appendChild(km); }
          const p = state.board[i];
          if (p) {
            const pe = document.createElement("div");
            const useSvg = window.PIECES && document.body.dataset.pieceStyle !== "glyph";
            pe.className = "piece " + p.c + (useSvg ? " svg" : "");
            if (useSvg) pe.innerHTML = PIECES.svg(p.t, p.c);
            else pe.textContent = G[p.c][p.t];
            if (dragging && dragging.from === i) pe.style.opacity = ".28";
            sq.appendChild(pe);
          }
          if (dests.includes(i)) {
            const d = document.createElement("div");
            d.className = p ? "ring" : "dot";
            sq.appendChild(d);
          }
          // συντεταγμένες στα άκρα
          if (dc === 0) { const cr = document.createElement("span"); cr.className = "coord rank"; cr.textContent = (8 - r); sq.appendChild(cr); }
          if (dr === 7) { const cf = document.createElement("span"); cf.className = "coord file"; cf.textContent = FILES[c]; sq.appendChild(cf); }
          board.appendChild(sq);
        }
      }
    }

    board.addEventListener("click", (e) => {
      if (!interactive || pendingPromo) return;
      const sq = e.target.closest(".sq");
      if (!sq) return;
      const i = parseInt(sq.dataset.i, 10);
      if (selected != null) {
        const moves = legalFrom(selected).filter(m => m.to === i);
        if (moves.length) {
          if (moves.length > 1 && moves[0].promo) { askPromo(selected, i, moves); return; }
          doMove(moves[0]);
          return;
        }
      }
      const p = state.board[i];
      if (p && p.c === state.turn) { selected = i; redraw(); }
      else { selected = null; redraw(); }
    });

    // ---- Drag & Drop (pointer) ----
    function ghostSize() { return board.getBoundingClientRect().width / 8; }
    function moveGhost(e) {
      if (!dragging) return;
      const s = ghostSize();
      dragging.ghost.style.left = (e.clientX - s / 2) + "px";
      dragging.ghost.style.top = (e.clientY - s / 2) + "px";
    }
    board.addEventListener("pointerdown", (e) => {
      if (!interactive || !enableDrag || pendingPromo) return;
      const sq = e.target.closest(".sq"); if (!sq) return;
      const i = parseInt(sq.dataset.i, 10);
      const p = state.board[i];
      if (!p || p.c !== state.turn) return;
      e.preventDefault();
      selected = i;
      const s = ghostSize();
      const ghost = document.createElement("div");
      ghost.className = "drag-ghost piece " + p.c + (window.PIECES && document.body.dataset.pieceStyle !== "glyph" ? " svg" : "");
      if (window.PIECES && document.body.dataset.pieceStyle !== "glyph") ghost.innerHTML = PIECES.svg(p.t, p.c);
      else ghost.textContent = G[p.c][p.t];
      ghost.style.width = s + "px"; ghost.style.height = s + "px";
      document.body.appendChild(ghost);
      dragging = { from: i, ghost, moved: false };
      redraw();
      moveGhost(e);
    });
    window.addEventListener("pointermove", (e) => { if (dragging) { dragging.moved = true; moveGhost(e); } });
    window.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      const from = dragging.from;
      dragging.ghost.remove();
      const wasDrag = dragging.moved;
      dragging = null;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const sq = el && el.closest(".sq");
      if (sq && sq.closest(".chessboard") === board) {
        const to = parseInt(sq.dataset.i, 10);
        if (to === from && !wasDrag) { redraw(); return; } // απλό κλικ = επιλογή
        const moves = legalFrom(from).filter(m => m.to === to);
        if (moves.length) {
          if (moves.length > 1 && moves[0].promo) askPromo(from, to, moves);
          else doMove(moves[0], { noAnim: wasDrag });
        } else { selected = wasDrag ? null : from; redraw(); }
      } else { selected = null; redraw(); }
    });

    function askPromo(from, to, moves) {
      pendingPromo = { from, to };
      const overlay = document.createElement("div");
      overlay.className = "promo-pick";
      moves.forEach(m => {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = G[state.turn][m.promo];
        b.onclick = () => { container.querySelector(".promo-pick")?.remove(); pendingPromo = null; doMove(m); };
        overlay.appendChild(b);
      });
      container.appendChild(overlay);
    }

    function flyPiece(fromRect, toEl) {
      const toRect = toEl.getBoundingClientRect();
      const fly = document.createElement("div");
      fly.className = "fly-piece " + toEl.className;
      fly.innerHTML = toEl.innerHTML;
      fly.style.width = toRect.width + "px"; fly.style.height = toRect.height + "px";
      fly.style.left = fromRect.left + "px"; fly.style.top = fromRect.top + "px";
      document.body.appendChild(fly);
      toEl.style.opacity = "0";
      requestAnimationFrame(() => {
        fly.style.transition = "left .2s cubic-bezier(.34,.72,.28,1), top .2s cubic-bezier(.34,.72,.28,1)";
        fly.style.left = toRect.left + "px"; fly.style.top = toRect.top + "px";
      });
      setTimeout(() => { fly.remove(); toEl.style.opacity = ""; }, 220);
    }

    function doMove(m, o) {
      o = o || {};
      const san = Chess.toSAN(state, m);
      const wasCapture = m.ep || !!state.board[m.to];
      if (window.SFX) { wasCapture ? SFX.capture() : SFX.move(); }
      const fromEl = (!o.noAnim) ? board.querySelector(`.sq[data-i="${m.from}"] .piece`) : null;
      const fromRect = fromEl ? fromEl.getBoundingClientRect() : null;
      history.push(Chess.toFEN(state));
      state = Chess.makeMove(state, m);
      lastMove = { from: m.from, to: m.to };
      selected = null;
      hint = null;
      redraw();
      if (fromRect) { const toEl = board.querySelector(`.sq[data-i="${m.to}"] .piece`); if (toEl) flyPiece(fromRect, toEl); }
      const st = Chess.status(state);
      onMove(state, m, san, st);
      if (st === "checkmate" || st === "stalemate" || st === "draw50" || st === "insufficient") onEnd(st);
    }

    // ------- Δημόσιο API -------
    const api = {
      el: board,
      getState: () => state,
      turn: () => state.turn,
      status: () => Chess.status(state),
      setInteractive(v) { interactive = v; selected = null; redraw(); },
      flip() { flipped = !flipped; redraw(); },
      setFlipped(v) { flipped = !!v; redraw(); },
      setHint(m) { hint = m ? { from: m.from, to: m.to } : null; redraw(); },
      clearHint() { hint = null; redraw(); },
      setFEN(fen) { state = Chess.fromFEN(fen); selected = null; lastMove = null; hint = null; history = []; redraw(); },
      reset() { api.setFEN(Chess.START_FEN); },
      redraw,
      canUndo: () => history.length > 0,
      undo() {
        if (!history.length) return false;
        state = Chess.fromFEN(history.pop());
        selected = null; lastMove = null; redraw(); return true;
      },
      // Εκτέλεση κίνησης από AI
      aiMove(depth) {
        const m = Chess.bestMove(state, depth || 2);
        if (m) doMove(m);
        return m;
      },
      // Εκτέλεση κίνησης με βάση SAN (για ανοίγματα)
      moveBySAN(san) {
        const clean = san.replace(/[+#!?]/g, "");
        const legal = Chess.legalMoves(state);
        for (const m of legal) {
          if (Chess.toSAN(state, m).replace(/[+#!?]/g, "") === clean) { doMove(m); return true; }
        }
        return false;
      },
      // Δοκιμή κίνησης παίκτη (για puzzles): επιστρέφει {ok, san, coord}
      tryUserMove(from, to) {
        const moves = Chess.movesFrom(state, from).filter(m => m.to === to);
        if (!moves.length) return null;
        const m = moves[0];
        return { move: m, coord: Chess.sqName(from) + Chess.sqName(to), san: Chess.toSAN(state, m) };
      },
      forceMove(m) { doMove(m); },
    };
    redraw();
    return api;
  }

  global.createBoard = createBoard;
})(window);
