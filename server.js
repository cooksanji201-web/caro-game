/**
 * Caro Game Online Server
 * Real-time multiplayer server using Socket.io
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Game rooms storage
const rooms = new Map();

// Generate random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create a new room
function createRoom(hostSocket, settings = {}) {
    let code;
    do {
        code = generateRoomCode();
    } while (rooms.has(code));

    const room = {
        code,
        host: hostSocket.id,
        guest: null,
        board: Array(settings.size || 15).fill(null).map(() =>
            Array(settings.size || 15).fill(null)
        ),
        size: settings.size || 15,
        currentPlayer: 'X', // Host is always X
        gameStarted: false,
        gameOver: false,
        winner: null,
        moveHistory: [],
        createdAt: Date.now()
    };

    rooms.set(code, room);
    hostSocket.join(code);

    return room;
}

// Join an existing room
function joinRoom(guestSocket, code) {
    const room = rooms.get(code);

    if (!room) {
        return { error: 'Phòng không tồn tại' };
    }

    if (room.guest) {
        return { error: 'Phòng đã đầy' };
    }

    room.guest = guestSocket.id;
    room.gameStarted = true;
    guestSocket.join(code);

    return { success: true, room };
}

// Make a move
function makeMove(room, socketId, row, col) {
    if (room.gameOver) {
        return { error: 'Game đã kết thúc' };
    }

    // Check if it's this player's turn
    const isHost = socketId === room.host;
    const expectedPlayer = room.currentPlayer;
    const isPlayerTurn = (isHost && expectedPlayer === 'X') || (!isHost && expectedPlayer === 'O');

    if (!isPlayerTurn) {
        return { error: 'Chưa đến lượt của bạn' };
    }

    // Check if cell is empty
    if (room.board[row][col] !== null) {
        return { error: 'Ô này đã có người đánh' };
    }

    // Make the move
    room.board[row][col] = room.currentPlayer;
    room.moveHistory.push({ row, col, player: room.currentPlayer });

    // Check for win
    const winResult = checkWin(room, row, col);
    if (winResult.win) {
        room.gameOver = true;
        room.winner = room.currentPlayer;
        return {
            success: true,
            row,
            col,
            player: room.currentPlayer,
            gameOver: true,
            winner: room.currentPlayer,
            winningCells: winResult.cells
        };
    }

    // Check for draw
    if (checkDraw(room)) {
        room.gameOver = true;
        room.winner = 'draw';
        return {
            success: true,
            row,
            col,
            player: room.currentPlayer,
            gameOver: true,
            winner: 'draw'
        };
    }

    // Switch player
    const prevPlayer = room.currentPlayer;
    room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';

    return {
        success: true,
        row,
        col,
        player: prevPlayer,
        nextPlayer: room.currentPlayer
    };
}

// Check for win
function checkWin(room, row, col) {
    const player = room.board[row][col];
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const size = room.size;

    for (const [dr, dc] of directions) {
        const cells = [{ row, col }];

        // Forward
        for (let i = 1; i < 5; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r >= 0 && r < size && c >= 0 && c < size && room.board[r][c] === player) {
                cells.push({ row: r, col: c });
            } else break;
        }

        // Backward
        for (let i = 1; i < 5; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (r >= 0 && r < size && c >= 0 && c < size && room.board[r][c] === player) {
                cells.push({ row: r, col: c });
            } else break;
        }

        if (cells.length >= 5) {
            return { win: true, cells };
        }
    }

    return { win: false };
}

// Check for draw
function checkDraw(room) {
    return room.board.every(row => row.every(cell => cell !== null));
}

// Reset room for new game
function resetRoom(room) {
    room.board = Array(room.size).fill(null).map(() => Array(room.size).fill(null));
    room.currentPlayer = 'X';
    room.gameOver = false;
    room.winner = null;
    room.moveHistory = [];
}

// Clean up old rooms (rooms without activity for 30 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
        if (now - room.createdAt > 30 * 60 * 1000 && !room.guest) {
            rooms.delete(code);
            console.log(`Cleaned up room ${code}`);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create a new room
    socket.on('createRoom', (settings, callback) => {
        const room = createRoom(socket, settings);
        console.log(`Room created: ${room.code} by ${socket.id}`);
        callback({ code: room.code, size: room.size });
    });

    // Join an existing room
    socket.on('joinRoom', (code, callback) => {
        const result = joinRoom(socket, code.toUpperCase());

        if (result.error) {
            callback({ error: result.error });
            return;
        }

        console.log(`Player ${socket.id} joined room ${code}`);

        // Notify host that guest joined
        io.to(result.room.host).emit('playerJoined', {
            guestId: socket.id
        });

        callback({
            success: true,
            size: result.room.size,
            isHost: false
        });
    });

    // Make a move
    socket.on('move', ({ roomCode, row, col }, callback) => {
        const room = rooms.get(roomCode);

        if (!room) {
            callback({ error: 'Phòng không tồn tại' });
            return;
        }

        const result = makeMove(room, socket.id, row, col);

        if (result.error) {
            callback({ error: result.error });
            return;
        }

        // Broadcast move to all players in room
        io.to(roomCode).emit('moveMade', result);
        callback({ success: true });
    });

    // Request new game
    socket.on('requestNewGame', (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        // Notify the other player
        socket.to(roomCode).emit('newGameRequested', {
            requesterId: socket.id
        });
    });

    // Accept new game
    socket.on('acceptNewGame', (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        resetRoom(room);
        io.to(roomCode).emit('gameReset', { size: room.size });
    });

    // Chat message (optional)
    socket.on('chat', ({ roomCode, message }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        const isHost = socket.id === room.host;
        io.to(roomCode).emit('chatMessage', {
            sender: isHost ? 'X' : 'O',
            message: message.substring(0, 200) // Limit message length
        });
    });

    // Player disconnected
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Find rooms where this player was
        for (const [code, room] of rooms.entries()) {
            if (room.host === socket.id) {
                // Host left - notify guest and close room
                if (room.guest) {
                    io.to(room.guest).emit('opponentLeft', {
                        message: 'Đối thủ đã rời phòng'
                    });
                }
                rooms.delete(code);
                console.log(`Room ${code} closed (host left)`);
            } else if (room.guest === socket.id) {
                // Guest left - notify host
                room.guest = null;
                room.gameStarted = false;
                io.to(room.host).emit('opponentLeft', {
                    message: 'Đối thủ đã rời phòng'
                });
                console.log(`Guest left room ${code}`);
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║         🎮 CARO PRO ONLINE SERVER         ║
╠═══════════════════════════════════════════╣
║  Server running at:                       ║
║  → http://localhost:${PORT}                   ║
║                                           ║
║  Share this with friends to play online!  ║
╚═══════════════════════════════════════════╝
    `);
});
