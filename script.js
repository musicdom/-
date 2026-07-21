// ============================================
// Шашки Premium - Полная логика с меню, ИИ и компонентами
// ============================================

(() => {
    'use strict';

    // --- Константы ---
    const BOARD_SIZE = 8;
    const EMPTY = 0;
    const WHITE = 1;
    const BLACK = 2;
    const KING = 4;

    // --- DOM ---
    const menuScreen = document.getElementById('menu-screen');
    const gameScreen = document.getElementById('game-screen');
    const settingsScreen = document.getElementById('settings-screen');
    const boardEl = document.getElementById('board');
    const turnIndicator = document.getElementById('turn-indicator');
    const whiteScoreEl = document.getElementById('white-score');
    const blackScoreEl = document.getElementById('black-score');
    const playBtn = document.getElementById('play-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const vsBotBtn = document.getElementById('vs-bot-btn');
    const vsFriendBtn = document.getElementById('vs-friend-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const backToMenuFromGame = document.getElementById('back-to-menu-from-game');
    const backToMenuFromSettings = document.getElementById('back-to-menu-from-settings');
    const newGameBtn = document.getElementById('new-game-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const undoBtn = document.getElementById('undo-btn');
    const hintBtn = document.getElementById('hint-btn');
    const settingsGameBtn = document.getElementById('settings-game-btn');
    const modal = document.getElementById('modal');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    const bottomSheet = document.getElementById('bottom-sheet');
    const sheetOverlay = document.getElementById('sheet-overlay');
    const sheetClose = document.getElementById('sheet-close');
    const toast = document.getElementById('toast');
    const toastClose = document.getElementById('toast-close');
    const showToastBtn = document.getElementById('show-toast-btn');
    const showModalBtn = document.getElementById('show-modal-btn');
    const showBottomSheetBtn = document.getElementById('show-bottom-sheet-btn');
    const fabDemo = document.getElementById('fab-demo');
    const modeSelection = document.getElementById('mode-selection');
    const menuButtons = document.getElementById('menu-buttons');

    // --- Состояние игры ---
    let board = [];
    let currentPlayer = WHITE;
    let selectedCell = null;
    let validMoves = [];
    let moveHistory = [];
    let gameOver = false;
    let isBotGame = false;
    let botThinking = false;

    // --- Управление экранами ---
    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    function showModeSelection(show) {
        modeSelection.classList.toggle('active', show);
        menuButtons.style.display = show ? 'none' : 'flex';
    }

    function goToMenu() {
        showScreen('menu-screen');
        botThinking = false;
    }

    // --- Инициализация доски ---
    function initBoard() {
        board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if ((r + c) % 2 === 1) {
                    if (r < 3) board[r][c] = BLACK;
                    else if (r > 4) board[r][c] = WHITE;
                }
            }
        }
        currentPlayer = WHITE;
        selectedCell = null;
        validMoves = [];
        moveHistory = [];
        gameOver = false;
        botThinking = false;
        updateUI();
    }

    // --- Вспомогательные функции ---
    function isKing(piece) { return (piece & KING) !== 0; }
    function getColor(piece) { return piece & 3; }
    function makeKing(piece) { return piece | KING; }

    function getPlayerPieces(player) {
        const pieces = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] !== EMPTY && getColor(board[r][c]) === player) {
                    pieces.push({ row: r, col: c, piece: board[r][c] });
                }
            }
        }
        return pieces;
    }

    function hasMandatoryCapture(player) {
        const pieces = getPlayerPieces(player);
        for (let p of pieces) {
            const moves = getValidMovesForPiece(p.row, p.col, true);
            if (moves.length > 0 && moves.some(m => m.captured !== null)) return true;
        }
        return false;
    }

    function getValidMovesForPiece(row, col, onlyCapture = false) {
        const piece = board[row][col];
        if (piece === EMPTY) return [];
        const color = getColor(piece);
        const king = isKing(piece);
        const directions = [];
        if (color === WHITE || king) directions.push(-1);
        if (color === BLACK || king) directions.push(1);
        const moves = [];

        // Взятия
        for (let dRow of directions) {
            for (let dCol of [-1, 1]) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                const jumpRow = row + 2 * dRow;
                const jumpCol = col + 2 * dCol;
                if (jumpRow < 0 || jumpRow >= BOARD_SIZE || jumpCol < 0 || jumpCol >= BOARD_SIZE) continue;
                const target = board[newRow][newCol];
                if (target !== EMPTY && getColor(target) !== color) {
                    if (board[jumpRow][jumpCol] === EMPTY) {
                        moves.push({ row: jumpRow, col: jumpCol, captured: { row: newRow, col: newCol } });
                    }
                }
            }
        }
        if (moves.length > 0) return moves;
        if (onlyCapture) return [];

        // Обычные ходы
        for (let dRow of directions) {
            for (let dCol of [-1, 1]) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) continue;
                if (board[newRow][newCol] === EMPTY) {
                    moves.push({ row: newRow, col: newCol, captured: null });
                }
            }
        }
        return moves;
    }

    function getAllValidMoves(player) {
        const pieces = getPlayerPieces(player);
        let allMoves = [];
        let hasCapture = false;
        for (let p of pieces) {
            const moves = getValidMovesForPiece(p.row, p.col, false);
            for (let m of moves) {
                if (m.captured !== null) hasCapture = true;
                allMoves.push({ fromRow: p.row, fromCol: p.col, ...m });
            }
        }
        if (hasCapture) allMoves = allMoves.filter(m => m.captured !== null);
        return allMoves;
    }

    function makeMove(fromRow, fromCol, toRow, toCol, captured) {
        const piece = board[fromRow][fromCol];
        moveHistory.push({
            fromRow, fromCol, toRow, toCol,
            piece: piece,
            captured: captured ? board[captured.row][captured.col] : null,
            capturedPos: captured ? { row: captured.row, col: captured.col } : null,
            wasKing: isKing(piece)
        });

        board[toRow][toCol] = piece;
        board[fromRow][fromCol] = EMPTY;
        if (captured) {
            board[captured.row][captured.col] = EMPTY;
            updateScore();
        }
        if (getColor(piece) === WHITE && toRow === 0) board[toRow][toCol] = makeKing(piece);
        else if (getColor(piece) === BLACK && toRow === BOARD_SIZE - 1) board[toRow][toCol] = makeKing(piece);

        const extra = getValidMovesForPiece(toRow, toCol, true);
        if (extra.length > 0) return { chain: true, row: toRow, col: toCol };

        currentPlayer = (currentPlayer === WHITE) ? BLACK : WHITE;
        checkGameOver();
        return { chain: false };
    }

    function checkGameOver() {
        const moves = getAllValidMoves(currentPlayer);
        if (moves.length === 0) {
            gameOver = true;
            const winner = (currentPlayer === WHITE) ? 'Чёрные' : 'Белые';
            setTimeout(() => {
                alert(`🏆 Победили ${winner}!`);
                goToMenu();
            }, 300);
        }
    }

    function updateScore() {
        let w = 0, b = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = board[r][c];
                if (p !== EMPTY) {
                    if (getColor(p) === WHITE) w++; else b++;
                }
            }
        }
        whiteScoreEl.textContent = w;
        blackScoreEl.textContent = b;
    }

    // --- UI ---
    function renderBoard() {
        boardEl.innerHTML = '';
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(r + c) % 2 === 0 ? 'cell-light' : 'cell-dark'}`;
                cell.dataset.row = r;
                cell.dataset.col = c;
                const piece = board[r][c];
                if (piece !== EMPTY) {
                    const el = document.createElement('div');
                    const color = getColor(piece);
                    el.className = `piece ${color === WHITE ? 'piece-white' : 'piece-black'}`;
                    if (isKing(piece)) el.classList.add('piece-king');
                    cell.appendChild(el);
                }
                boardEl.appendChild(cell);
            }
        }
        // Восстановление выделения
        if (selectedCell) {
            const idx = selectedCell.row * BOARD_SIZE + selectedCell.col;
            const cell = boardEl.children[idx];
            if (cell) {
                const p = cell.querySelector('.piece');
                if (p) p.classList.add('selected');
            }
            for (let m of validMoves) {
                const idx2 = m.row * BOARD_SIZE + m.col;
                const cell2 = boardEl.children[idx2];
                if (cell2) cell2.classList.add('hint');
            }
        }
    }

    function clearHighlights() {
        document.querySelectorAll('.cell.hint').forEach(el => el.classList.remove('hint'));
        document.querySelectorAll('.piece.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.cell.last-move').forEach(el => el.classList.remove('last-move'));
    }

    function updateUI() {
        renderBoard();
        turnIndicator.textContent = currentPlayer === WHITE ? 'Белые' : 'Чёрные';
        turnIndicator.style.color = currentPlayer === WHITE ? '#fff' : '#aaa';
        updateScore();
        clearHighlights();
        if (selectedCell) {
            const idx = selectedCell.row * BOARD_SIZE + selectedCell.col;
            const cell = boardEl.children[idx];
            if (cell) {
                const p = cell.querySelector('.piece');
                if (p) p.classList.add('selected');
            }
            for (let m of validMoves) {
                const idx2 = m.row * BOARD_SIZE + m.col;
                const cell2 = boardEl.children[idx2];
                if (cell2) cell2.classList.add('hint');
            }
        }
    }

    function handleCellClick(e) {
        if (gameOver || botThinking) return;
        const cell = e.currentTarget;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const piece = board[row][col];

        if (piece === EMPTY) {
            if (selectedCell) {
                const move = validMoves.find(m => m.row === row && m.col === col);
                if (move) {
                    const result = makeMove(selectedCell.row, selectedCell.col, row, col, move.captured);
                    selectedCell = null;
                    validMoves = [];
                    updateUI();
                    if (result.chain) {
                        selectedCell = { row: result.row, col: result.col };
                        validMoves = getValidMovesForPiece(result.row, result.col, true);
                        updateUI();
                    } else {
                        if (isBotGame && currentPlayer === BLACK && !gameOver) scheduleBotMove();
                    }
                    return;
                }
            }
            selectedCell = null;
            validMoves = [];
            updateUI();
            return;
        }

        const color = getColor(piece);
        if (color === currentPlayer) {
            const mandatory = hasMandatoryCapture(currentPlayer);
            const moves = getValidMovesForPiece(row, col, mandatory);
            if (mandatory && moves.length === 0) {
                selectedCell = null;
                validMoves = [];
                updateUI();
                return;
            }
            selectedCell = { row, col };
            validMoves = moves;
            updateUI();
        } else {
            selectedCell = null;
            validMoves = [];
            updateUI();
        }
    }

    // --- Бот ---
    function getBotMove() {
        const moves = getAllValidMoves(BLACK);
        if (moves.length === 0) return null;
        moves.sort((a, b) => (a.captured ? 0 : 1) - (b.captured ? 0 : 1));
        const best = moves.filter(m => (m.captured !== null) === (moves[0].captured !== null));
        return best[Math.floor(Math.random() * best.length)];
    }

    function scheduleBotMove() {
        if (!isBotGame || currentPlayer !== BLACK || gameOver) return;
        botThinking = true;
        setTimeout(() => {
            if (gameOver) { botThinking = false; return; }
            const move = getBotMove();
            if (!move) { botThinking = false; checkGameOver(); return; }
            const result = makeMove(move.fromRow, move.fromCol, move.row, move.col, move.captured);
            selectedCell = null;
            validMoves = [];
            updateUI();
            if (result.chain) {
                selectedCell = { row: result.row, col: result.col };
                validMoves = getValidMovesForPiece(result.row, result.col, true);
                updateUI();
                setTimeout(() => { botThinking = false; scheduleBotMove(); }, 300);
            } else {
                botThinking = false;
                if (!gameOver && isBotGame && currentPlayer === BLACK) scheduleBotMove();
            }
        }, 400);
    }

    function startNewGame(vsBot) {
        isBotGame = vsBot;
        initBoard();
        selectedCell = null;
        validMoves = [];
        gameOver = false;
        botThinking = false;
        showScreen('game-screen');
        updateUI();
    }

    // --- Отмена, подсказка ---
    function undoMove() {
        if (moveHistory.length === 0 || botThinking) return;
        const last = moveHistory.pop();
        board[last.fromRow][last.fromCol] = last.piece;
        board[last.toRow][last.toCol] = EMPTY;
        if (last.capturedPos) board[last.capturedPos.row][last.capturedPos.col] = last.captured;
        if (last.wasKing) board[last.fromRow][last.fromCol] = makeKing(last.piece);
        currentPlayer = (currentPlayer === WHITE) ? BLACK : WHITE;
        selectedCell = null;
        validMoves = [];
        gameOver = false;
        updateUI();
    }

    function showHint() {
        if (gameOver || botThinking) return;
        const moves = getAllValidMoves(currentPlayer);
        if (moves.length === 0) return;
        const first = moves[0];
        selectedCell = { row: first.fromRow, col: first.fromCol };
        validMoves = getValidMovesForPiece(first.fromRow, first.fromCol, false)
            .filter(m => moves.some(mm => mm.fromRow === first.fromRow && mm.fromCol === first.fromCol && mm.row === m.row && mm.col === m.col));
        updateUI();
    }

    // --- Тема ---
    function toggleTheme() {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    }

    // --- Компоненты (Модалка, Bottom Sheet, Toast) ---
    function showModal(show) {
        modal.classList.toggle('active', show);
    }
    function showSheet(show) {
        bottomSheet.classList.toggle('active', show);
    }
    function showToast(msg = 'Успешно! Действие выполнено') {
        toast.querySelector('.toast__title').textContent = msg.split('!')[0] + '!';
        toast.querySelector('.toast__subtitle').textContent = msg.includes('!') ? msg.split('!')[1]?.trim() || 'Действие выполнено' : msg;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 4000);
    }

    // --- Инициализация ---
    function init() {
        // Меню
        playBtn.addEventListener('click', () => showModeSelection(true));
        backToMenuBtn.addEventListener('click', () => showModeSelection(false));
        vsBotBtn.addEventListener('click', () => { showModeSelection(false); startNewGame(true); });
        vsFriendBtn.addEventListener('click', () => { showModeSelection(false); startNewGame(false); });
        settingsBtn.addEventListener('click', () => {
            showScreen('settings-screen');
            // Запускаем скелетон-демо
            const demo = document.getElementById('skeleton-demo');
            demo.innerHTML = `<div class="skeleton-card glass-card">
                <div class="skeleton-card__avatar"></div>
                <div class="skeleton-card__line"></div>
                <div class="skeleton-card__line short"></div>
            </div>`;
            setTimeout(() => {
                demo.innerHTML = `<div class="glass-card" style="padding:var(--spacing-md);">
                    <div style="display:flex;align-items:center;gap:var(--spacing-md);">
                        <div style="width:48px;height:48px;border-radius:50%;background:var(--gradient-gold);"></div>
                        <div><div style="font-weight:600;">Загружено</div><div style="color:var(--text-secondary);">Данные готовы</div></div>
                    </div>
                </div>`;
            }, 2000);
        });

        // Игра
        backToMenuFromGame.addEventListener('click', goToMenu);
        backToMenuFromSettings.addEventListener('click', goToMenu);
        newGameBtn.addEventListener('click', () => startNewGame(isBotGame));
        themeToggle.addEventListener('click', toggleTheme);
        undoBtn.addEventListener('click', undoMove);
        hintBtn.addEventListener('click', showHint);
        settingsGameBtn.addEventListener('click', toggleTheme);

        // Клик по доске
        boardEl.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (cell) handleCellClick({ currentTarget: cell });
        });

        // Модалка
        modalOverlay.addEventListener('click', () => showModal(false));
        modalClose.addEventListener('click', () => showModal(false));
        modalCancel.addEventListener('click', () => showModal(false));
        modalConfirm.addEventListener('click', () => {
            showModal(false);
            showToast('Подтверждено! Действие выполнено');
        });

        // Bottom Sheet
        sheetOverlay.addEventListener('click', () => showSheet(false));
        sheetClose.addEventListener('click', () => showSheet(false));

        // Toast
        toastClose.addEventListener('click', () => toast.classList.remove('visible'));

        // Демо-кнопки в настройках
        showToastBtn.addEventListener('click', () => showToast('Уведомление! Это тестовый тост'));
        showModalBtn.addEventListener('click', () => showModal(true));
        showBottomSheetBtn.addEventListener('click', () => showSheet(true));
        fabDemo.addEventListener('click', () => {
            showToast('FAB нажат!');
            fabDemo.style.transform = 'scale(0.8)';
            setTimeout(() => fabDemo.style.transform = 'scale(1)', 150);
        });

        // Размер доски
        function updateBoardSize() {
            const root = document.documentElement;
            const size = Math.min(window.innerWidth * 0.85, window.innerHeight * 0.65, 500);
            root.style.setProperty('--board-size', size + 'px');
        }
        window.addEventListener('resize', updateBoardSize);
        setTimeout(updateBoardSize, 50);

        // Старт в меню
        initBoard();
        showScreen('menu-screen');
        showModeSelection(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
