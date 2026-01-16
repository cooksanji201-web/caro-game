/**
 * Caro Game - Core Game Logic
 */

class CaroGame {
    constructor(size = 15) {
        this.size = size;
        this.board = [];
        this.currentPlayer = 'X';
        this.gameOver = false;
        this.winner = null;
        this.winningCells = [];
        this.moveHistory = [];
        this.winCondition = 5; // 5 in a row to win

        this.init();
    }

    init() {
        this.board = Array(this.size).fill(null).map(() =>
            Array(this.size).fill(null)
        );
        this.currentPlayer = 'X';
        this.gameOver = false;
        this.winner = null;
        this.winningCells = [];
        this.moveHistory = [];
    }

    reset(newSize = null) {
        if (newSize) {
            this.size = newSize;
        }
        this.init();
    }

    makeMove(row, col) {
        if (this.gameOver || this.board[row][col] !== null) {
            return false;
        }

        this.board[row][col] = this.currentPlayer;
        this.moveHistory.push({ row, col, player: this.currentPlayer });

        // Check for win
        if (this.checkWin(row, col)) {
            this.gameOver = true;
            this.winner = this.currentPlayer;
            return { win: true, player: this.currentPlayer, cells: this.winningCells };
        }

        // Check for draw
        if (this.checkDraw()) {
            this.gameOver = true;
            this.winner = 'draw';
            return { draw: true };
        }

        // Switch player
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        return { success: true };
    }

    undoMove() {
        if (this.moveHistory.length === 0) return false;

        // Undo last two moves (player + AI)
        const movesToUndo = Math.min(2, this.moveHistory.length);

        for (let i = 0; i < movesToUndo; i++) {
            const lastMove = this.moveHistory.pop();
            if (lastMove) {
                this.board[lastMove.row][lastMove.col] = null;
            }
        }

        this.currentPlayer = 'X';
        this.gameOver = false;
        this.winner = null;
        this.winningCells = [];

        return true;
    }

    checkWin(row, col) {
        const player = this.board[row][col];
        const directions = [
            [0, 1],   // Horizontal
            [1, 0],   // Vertical
            [1, 1],   // Diagonal \
            [1, -1]   // Diagonal /
        ];

        for (const [dr, dc] of directions) {
            const cells = this.countDirection(row, col, dr, dc, player);
            if (cells.length >= this.winCondition) {
                this.winningCells = cells;
                return true;
            }
        }

        return false;
    }

    countDirection(row, col, dr, dc, player) {
        const cells = [{ row, col }];

        // Count forward
        for (let i = 1; i < this.winCondition; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (this.isValidCell(r, c) && this.board[r][c] === player) {
                cells.push({ row: r, col: c });
            } else {
                break;
            }
        }

        // Count backward
        for (let i = 1; i < this.winCondition; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (this.isValidCell(r, c) && this.board[r][c] === player) {
                cells.push({ row: r, col: c });
            } else {
                break;
            }
        }

        return cells;
    }

    isValidCell(row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    checkDraw() {
        return this.board.every(row => row.every(cell => cell !== null));
    }

    getEmptyCells() {
        const cells = [];
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                if (this.board[row][col] === null) {
                    cells.push({ row, col });
                }
            }
        }
        return cells;
    }

    getLastMove() {
        return this.moveHistory[this.moveHistory.length - 1] || null;
    }

    // Evaluate board position for AI
    evaluatePosition(row, col, player) {
        let score = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            const lineScore = this.evaluateLine(row, col, dr, dc, player);
            score += lineScore;
        }

        // Center bonus
        const centerDist = Math.abs(row - this.size / 2) + Math.abs(col - this.size / 2);
        score += (this.size - centerDist) * 2;

        return score;
    }

    evaluateLine(row, col, dr, dc, player) {
        let count = 1;
        let openEnds = 0;
        let blocked = 0;

        // Forward
        let r = row + dr;
        let c = col + dc;
        while (this.isValidCell(r, c) && this.board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }
        if (this.isValidCell(r, c) && this.board[r][c] === null) {
            openEnds++;
        } else if (!this.isValidCell(r, c) || this.board[r][c] !== null) {
            blocked++;
        }

        // Backward
        r = row - dr;
        c = col - dc;
        while (this.isValidCell(r, c) && this.board[r][c] === player) {
            count++;
            r -= dr;
            c -= dc;
        }
        if (this.isValidCell(r, c) && this.board[r][c] === null) {
            openEnds++;
        } else if (!this.isValidCell(r, c) || this.board[r][c] !== null) {
            blocked++;
        }

        // Score based on count and open ends
        if (count >= 5) return 100000;
        if (count === 4 && openEnds === 2) return 50000;
        if (count === 4 && openEnds === 1) return 10000;
        if (count === 3 && openEnds === 2) return 5000;
        if (count === 3 && openEnds === 1) return 500;
        if (count === 2 && openEnds === 2) return 200;
        if (count === 2 && openEnds === 1) return 50;

        return count * 10;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaroGame;
}
