/**
 * Caro Game - AI Player
 * Uses Minimax with Alpha-Beta Pruning and heuristic evaluation
 */

class CaroAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.depths = {
            easy: 1,
            medium: 2,
            hard: 3
        };
        this.evaluated = 0;
    }

    setDifficulty(level) {
        this.difficulty = level;
    }

    getMove(game) {
        this.evaluated = 0;
        const startTime = performance.now();

        // If first move, play near center
        if (game.moveHistory.length === 0) {
            const center = Math.floor(game.size / 2);
            return { row: center, col: center };
        }

        // If second move (AI plays first response), play adjacent to player
        if (game.moveHistory.length === 1) {
            const lastMove = game.getLastMove();
            const offsets = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
            const randomOffset = offsets[Math.floor(Math.random() * offsets.length)];
            const row = Math.max(0, Math.min(game.size - 1, lastMove.row + randomOffset[0]));
            const col = Math.max(0, Math.min(game.size - 1, lastMove.col + randomOffset[1]));
            return { row, col };
        }

        // Get candidate moves (cells near existing pieces)
        const candidates = this.getCandidateMoves(game);

        if (candidates.length === 0) {
            const center = Math.floor(game.size / 2);
            return { row: center, col: center };
        }

        // For easy mode, sometimes make random moves
        if (this.difficulty === 'easy' && Math.random() < 0.3) {
            return candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
        }

        // Find best move using minimax
        let bestMove = candidates[0];
        let bestScore = -Infinity;
        const depth = this.depths[this.difficulty];

        for (const move of candidates.slice(0, 15)) { // Limit search space
            game.board[move.row][move.col] = 'O';
            const score = this.minimax(game, depth - 1, -Infinity, Infinity, false, move);
            game.board[move.row][move.col] = null;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        const endTime = performance.now();
        console.log(`AI evaluated ${this.evaluated} positions in ${(endTime - startTime).toFixed(0)}ms`);

        return bestMove;
    }

    getCandidateMoves(game) {
        const candidates = new Map();
        const searchRadius = 2;

        // Find all cells near existing pieces
        for (let row = 0; row < game.size; row++) {
            for (let col = 0; col < game.size; col++) {
                if (game.board[row][col] !== null) {
                    // Add empty neighbors
                    for (let dr = -searchRadius; dr <= searchRadius; dr++) {
                        for (let dc = -searchRadius; dc <= searchRadius; dc++) {
                            const r = row + dr;
                            const c = col + dc;
                            const key = `${r},${c}`;

                            if (game.isValidCell(r, c) && game.board[r][c] === null && !candidates.has(key)) {
                                // Calculate priority score
                                const score = this.evaluateCell(game, r, c);
                                candidates.set(key, { row: r, col: c, score });
                            }
                        }
                    }
                }
            }
        }

        // Sort by score (descending)
        return Array.from(candidates.values())
            .sort((a, b) => b.score - a.score);
    }

    evaluateCell(game, row, col) {
        // Quick heuristic for candidate prioritization
        let score = 0;

        // Check for immediate threats or opportunities
        game.board[row][col] = 'O';
        score += this.evaluatePatterns(game, row, col, 'O') * 1.1;
        game.board[row][col] = null;

        game.board[row][col] = 'X';
        score += this.evaluatePatterns(game, row, col, 'X');
        game.board[row][col] = null;

        return score;
    }

    minimax(game, depth, alpha, beta, isMaximizing, lastMove) {
        this.evaluated++;

        // Check terminal states
        if (lastMove && this.checkWinFast(game, lastMove.row, lastMove.col)) {
            return isMaximizing ? -100000 - depth : 100000 + depth;
        }

        if (depth === 0) {
            return this.evaluateBoard(game);
        }

        const candidates = this.getCandidateMoves(game).slice(0, 10);

        if (candidates.length === 0) {
            return 0;
        }

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of candidates) {
                game.board[move.row][move.col] = 'O';
                const score = this.minimax(game, depth - 1, alpha, beta, false, move);
                game.board[move.row][move.col] = null;

                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const move of candidates) {
                game.board[move.row][move.col] = 'X';
                const score = this.minimax(game, depth - 1, alpha, beta, true, move);
                game.board[move.row][move.col] = null;

                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    checkWinFast(game, row, col) {
        const player = game.board[row][col];
        if (!player) return false;

        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            let count = 1;

            // Forward
            let r = row + dr, c = col + dc;
            while (game.isValidCell(r, c) && game.board[r][c] === player) {
                count++;
                r += dr;
                c += dc;
            }

            // Backward
            r = row - dr;
            c = col - dc;
            while (game.isValidCell(r, c) && game.board[r][c] === player) {
                count++;
                r -= dr;
                c -= dc;
            }

            if (count >= 5) return true;
        }

        return false;
    }

    evaluateBoard(game) {
        let score = 0;

        // Evaluate all cells with pieces
        for (let row = 0; row < game.size; row++) {
            for (let col = 0; col < game.size; col++) {
                if (game.board[row][col] === 'O') {
                    score += this.evaluatePatterns(game, row, col, 'O');
                } else if (game.board[row][col] === 'X') {
                    score -= this.evaluatePatterns(game, row, col, 'X');
                }
            }
        }

        return score;
    }

    evaluatePatterns(game, row, col, player) {
        let totalScore = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            const { count, openEnds } = this.analyzeDirection(game, row, col, dr, dc, player);
            totalScore += this.getPatternScore(count, openEnds);
        }

        return totalScore;
    }

    analyzeDirection(game, row, col, dr, dc, player) {
        let count = 1;
        let openEnds = 0;

        // Forward
        let r = row + dr, c = col + dc;
        while (game.isValidCell(r, c) && game.board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }
        if (game.isValidCell(r, c) && game.board[r][c] === null) {
            openEnds++;
        }

        // Backward
        r = row - dr;
        c = col - dc;
        while (game.isValidCell(r, c) && game.board[r][c] === player) {
            count++;
            r -= dr;
            c -= dc;
        }
        if (game.isValidCell(r, c) && game.board[r][c] === null) {
            openEnds++;
        }

        return { count, openEnds };
    }

    getPatternScore(count, openEnds) {
        // Pattern scoring table
        if (count >= 5) return 100000;

        if (count === 4) {
            if (openEnds === 2) return 50000;
            if (openEnds === 1) return 5000;
            return 100;
        }

        if (count === 3) {
            if (openEnds === 2) return 3000;
            if (openEnds === 1) return 300;
            return 50;
        }

        if (count === 2) {
            if (openEnds === 2) return 100;
            if (openEnds === 1) return 30;
            return 5;
        }

        if (count === 1) {
            if (openEnds === 2) return 10;
            if (openEnds === 1) return 3;
        }

        return 0;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaroAI;
}
