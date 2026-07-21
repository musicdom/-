// ============================================
// Шашки Premium - Полная игровая логика
// ============================================

(() => {
    'use strict';

    // --- Константы ---
    const BOARD_SIZE = 8;
    const EMPTY = 0;
    const WHITE = 1;
    const BLACK = 2;
    const KING = 4; // битовая маска

    // --- DOM ---
    const boardEl = document.getElementById('board');
    const turnIndicator = document.getElementById('turn-indicator');
    const whiteScoreEl = document.getElementById('white-score');
    const blackScoreEl = document.getElementById('black-score');
    const newGameBtn = document.getElementById('new-game-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const undoBtn = document.getElementById('undo-btn');
    const hintBtn = document.getElementById('hint-btn');

    // --- Состояние ---
    let board = [];
    let currentPlayer = WHITE; // WHITE ходит первым
    let selectedCell = null; // { row, col }
    let validMoves = []; // [{ row, col, captured }]
    let moveHistory = [];
    let gameOver = false;

    // --- Инициализация ---
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
        updateUI();
    }

    // --- Проверка, является ли фигура дамкой ---
    function isKing(piece) {
        return (piece & KING) !== 0;
    }

    function getColor(piece) {
        return piece & 3; // 1=WHITE, 2=BLACK
    }

    function makeKing(piece) {
        return piece | KING;
    }

    // --- Получение всех фигур текущего игрока ---
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

    // --- Проверка, есть ли обязательные взятия для игрока ---
    function hasMandatoryCapture(player) {
        const pieces = getPlayerPieces(player);
        for (let p of pieces) {
            const moves = getValidMovesForPiece(p.row, p.col, true); // только взятия
            if (moves.length > 0 && moves.some(m => m.captured !== null)) {
                return true;
            }
        }
        return false;
    }

    // --- Получение допустимых ходов для фигуры (опционально только взятия) ---
    function getValidMovesForPiece(row, col, onlyCapture = false) {
        const piece = board[row][col];
        if (piece === EMPTY) return [];
        const color = getColor(piece);
        const king = isKing(piece);
        const directions = [];
        if (color === WHITE || king) directions.push(-1); // вверх (уменьшение row)
        if (color === BLACK || king) directions.push(1);  // вниз (увеличение row)
        const moves = [];

        // Проверяем взятия (прыжки)
        for (let dRow of directions) {
            for (let dCol of [-1, 1]) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                const jumpRow = row + 2 * dRow;
                const jumpCol = col + 2 * dCol;
                if (jumpRow < 0 || jumpRow >= BOARD_SIZE || jumpCol < 0 || jumpCol >= BOARD_SIZE) continue;
                const target = board[newRow][newCol];
                if (target !== EMPTY && getColor(target) !== color) {
                    // Есть фигура противника, проверяем клетку за ней
                    if (board[jumpRow][jumpCol] === EMPTY) {
                        moves.push({ row: jumpRow, col: jumpCol, captured: { row: newRow, col: newCol } });
                    }
                }
            }
        }

        // Если есть взятия, возвращаем только их (обязательное взятие)
        if (moves.length > 0) return moves;

        if (onlyCapture) return []; // если требовались только взятия, а их нет

        // Обычные ходы (без взятия)
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

    // --- Получение всех допустимых ходов для игрока (с учётом обязательных взятий) ---
    function getAllValidMoves(player) {
        const pieces = getPlayerPieces(player);
        let allMoves = [];
        let hasCapture = false;
        // Сначала собираем все ходы
        for (let p of pieces) {
            const moves = getValidMovesForPiece(p.row, p.col, false);
            for (let m of moves) {
                if (m.captured !== null) hasCapture = true;
                allMoves.push({ fromRow: p.row, fromCol: p.col, ...m });
            }
        }
        // Если есть взятия, фильтруем только взятия
        if (hasCapture) {
            allMoves = allMoves.filter(m => m.captured !== null);
        }
        return allMoves;
    }

    // --- Выполнение хода ---
    function makeMove(fromRow, fromCol, toRow, toCol, captured) {
        const piece = board[fromRow][fromCol];
        // Сохраняем в историю
        moveHistory.push({
            fromRow, fromCol, toRow, toCol,
            piece: piece,
            captured: captured ? board[captured.row][captured.col] : null,
            capturedPos: captured ? { row: captured.row, col: captured.col } : null,
            wasKing: isKing(piece)
        });

        // Перемещаем фигуру
        board[toRow][toCol] = piece;
        board[fromRow][fromCol] = EMPTY;

        // Если была рубка
        if (captured) {
            board[captured.row][captured.col] = EMPTY;
            // Обновляем счёт
            updateScore();
        }

        // Превращение в дамку
        if (getColor(piece) === WHITE && toRow === 0) {
            board[toRow][toCol] = makeKing(piece);
        } else if (getColor(piece) === BLACK && toRow === BOARD_SIZE - 1) {
            board[toRow][toCol] = makeKing(piece);
        }

        // Проверяем, есть ли у этой фигуры дополнительные взятия (для цепочки)
        const newPiece = board[toRow][toCol];
        const extraMoves = getValidMovesForPiece(toRow, toCol, true);
        if (extraMoves.length > 0) {
            // Если есть, не переключаем игрока, а позволяем продолжить
            return { chain: true, row: toRow, col: toCol };
        }

        // Переключаем игрока
        currentPlayer = (currentPlayer === WHITE) ? BLACK : WHITE;
        // Проверяем, не закончилась ли игра
        checkGameOver();
        return { chain: false };
    }

    // --- Проверка окончания игры ---
    function checkGameOver() {
        const moves = getAllValidMoves(currentPlayer);
        if (moves.length === 0) {
            gameOver = true;
            // Победил другой игрок
            const winner = (currentPlayer === WHITE) ? 'Чёрные' : 'Белые';
            setTimeout(() => {
                alert(`🏆 Победили ${winner}!`);
            }, 100);
        }
    }

    // --- Обновление счёта ---
    function updateScore() {
        let white = 0, black = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = board[r][c];
                if (p !== EMPTY) {
                    if (getColor(p) === WHITE) white++;
                    else black++;
                }
            }
        }
        whiteScoreEl.textContent = white;
        blackScoreEl.textContent = black;
    }

    // --- Обновление UI ---
    function updateUI() {
        renderBoard();
        turnIndicator.textContent = currentPlayer === WHITE ? 'Белые' : 'Чёрные';
        turnIndicator.style.color = currentPlayer === WHITE ? '#fff' : '#aaa';
        updateScore();
        // Подсветка выбранной фигуры и подсказок
        clearHighlights();
        if (selectedCell) {
            const idx = selectedCell.row * BOARD_SIZE + selectedCell.col;
            const cellEl = boardEl.children[idx];
            if (cellEl) {
                const pieceEl = cellEl.querySelector('.piece');
                if (pieceEl) pieceEl.classList.add('selected');
            }
            // Показываем подсказки
            for (let m of validMoves) {
                const idx2 = m.row * BOARD_SIZE + m.col;
                const cellEl2 = boardEl.children[idx2];
                if (cellEl2) cellEl2.classList.add('hint');
            }
        }
    }

    function clearHighlights() {
        document.querySelectorAll('.cell.hint').forEach(el => el.classList.remove('hint'));
        document.querySelectorAll('.piece.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.cell.last-move').forEach(el => el.classList.remove('last-move'));
    }

    // --- Отрисовка доски ---
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
                    const pieceEl = document.createElement('div');
                    const color = getColor(piece);
                    pieceEl.className = `piece ${color === WHITE ? 'piece-white' : 'piece-black'}`;
                    if (isKing(piece)) pieceEl.classList.add('piece-king');
                    cell.appendChild(pieceEl);
                }
                boardEl.appendChild(cell);
            }
        }
        // Восстанавливаем подсветку, если есть
        if (selectedCell) {
            const idx = selectedCell.row * BOARD_SIZE + selectedCell.col;
            const cellEl = boardEl.children[idx];
            if (cellEl) {
                const pieceEl = cellEl.querySelector('.piece');
                if (pieceEl) pieceEl.classList.add('selected');
            }
            for (let m of validMoves) {
                const idx2 = m.row * BOARD_SIZE + m.col;
                const cellEl2 = boardEl.children[idx2];
                if (cellEl2) cellEl2.classList.add('hint');
            }
        }
    }

    // --- Обработка клика по клетке ---
    function handleCellClick(e) {
        const cell = e.currentTarget;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (gameOver) return;

        const piece = board[row][col];

        // Если клик по пустой клетке
        if (piece === EMPTY) {
            // Если есть выбранная фигура, пробуем сходить
            if (selectedCell) {
                // Проверяем, есть ли такой ход в допустимых
                const move = validMoves.find(m => m.row === row && m.col === col);
                if (move) {
                    // Выполняем ход
                    const result = makeMove(selectedCell.row, selectedCell.col, row, col, move.captured);
                    selectedCell = null;
                    validMoves = [];
                    updateUI();
                    // Если цепочка, то выделяем новую фигуру
                    if (result.chain) {
                        selectedCell = { row: result.row, col: result.col };
                        validMoves = getValidMovesForPiece(result.row, result.col, true);
                        updateUI();
                    }
                    return;
                }
            }
            // Иначе снимаем выделение
            selectedCell = null;
            validMoves = [];
            updateUI();
            return;
        }

        // Клик по своей фигуре
        const color = getColor(piece);
        if (color === currentPlayer) {
            // Проверяем, есть ли обязательные взятия у этого игрока
            const mandatory = hasMandatoryCapture(currentPlayer);
            const moves = getValidMovesForPiece(row, col, mandatory);
            // Если есть обязательные взятия, но у этой фигуры их нет, то не выбираем
            if (mandatory && moves.length === 0) {
                // Снимаем выделение
                selectedCell = null;
                validMoves = [];
                updateUI();
                return;
            }
            selectedCell = { row, col };
            validMoves = moves;
            updateUI();
        } else {
            // Клик по фигуре противника — снимаем выделение
            selectedCell = null;
            validMoves = [];
            updateUI();
        }
    }

    // --- Новая игра ---
    function newGame() {
        initBoard();
        selectedCell = null;
        validMoves = [];
        gameOver = false;
        updateUI();
        // Очищаем подсветку
        clearHighlights();
    }

    // --- Отмена хода (простая) ---
    function undoMove() {
        if (moveHistory.length === 0) return;
        const last = moveHistory.pop();
        // Восстанавливаем доску
        board[last.fromRow][last.fromCol] = last.piece;
        board[last.toRow][last.toCol] = EMPTY;
        if (last.capturedPos) {
            board[last.capturedPos.row][last.capturedPos.col] = last.captured;
        }
        // Если была дамка, но стала простой, то восстанавливаем
        if (last.wasKing) {
            board[last.fromRow][last.fromCol] = makeKing(last.piece);
        }
        // Возвращаем игрока
        currentPlayer = (currentPlayer === WHITE) ? BLACK : WHITE;
        selectedCell = null;
        validMoves = [];
        gameOver = false;
        updateUI();
    }

    // --- Подсказка (выделяем первую доступную фигуру с ходом) ---
    function showHint() {
        const moves = getAllValidMoves(currentPlayer);
        if (moves.length === 0) return;
        // Выбираем первый ход
        const first = moves[0];
        selectedCell = { row: first.fromRow, col: first.fromCol };
        validMoves = getValidMovesForPiece(first.fromRow, first.fromCol, false);
        // Фильтруем только ходы, которые есть в общем списке (для корректности)
        validMoves = validMoves.filter(m => 
            moves.some(mm => mm.fromRow === first.fromRow && mm.fromCol === first.fromCol && mm.row === m.row && mm.col === m.col)
        );
        updateUI();
    }

    // --- Переключение темы ---
    function toggleTheme() {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    }

    // --- Инициализация событий ---
    function init() {
        initBoard();
        // Делегирование кликов на доску
        boardEl.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (cell) handleCellClick({ currentTarget: cell });
        });

        newGameBtn.addEventListener('click', newGame);
        themeToggle.addEventListener('click', toggleTheme);
        undoBtn.addEventListener('click', undoMove);
        hintBtn.addEventListener('click', showHint);

        // Адаптация размера доски при ресайзе
        window.addEventListener('resize', () => {
            // Пересчитываем размеры через CSS переменные
            const root = document.documentElement;
            const size = Math.min(window.innerWidth * 0.85, window.innerHeight * 0.65, 500);
            root.style.setProperty('--board-size', size + 'px');
        });
        // Первый расчёт
        setTimeout(() => {
            const size = Math.min(window.innerWidth * 0.85, window.innerHeight * 0.65, 500);
            document.documentElement.style.setProperty('--board-size', size + 'px');
        }, 50);
    }

    // Запуск после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
