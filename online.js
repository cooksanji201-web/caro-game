/**
 * Caro Game - Online Multiplayer Client
 * Socket.io client for real-time multiplayer
 */

class OnlineClient {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.isHost = false;
        this.isConnected = false;
        this.isInRoom = false;
        this.onMoveCallback = null;
        this.onGameResetCallback = null;
        this.onOpponentLeftCallback = null;
        this.onPlayerJoinedCallback = null;
        this.onChatCallback = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            // Connect to server with timeout for Render cold start
            this.socket = io({
                timeout: 30000, // 30 seconds timeout for Render cold start
                reconnectionAttempts: 3,
                reconnectionDelay: 2000
            });

            // Set a connection timeout
            const connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    this.socket.disconnect();
                    reject(new Error('Kết nối timeout. Server có thể đang khởi động, vui lòng thử lại.'));
                }
            }, 35000);

            this.socket.on('connect', () => {
                clearTimeout(connectionTimeout);
                console.log('Connected to server');
                this.isConnected = true;
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.isConnected = false;
                // Don't reject immediately, let timeout handle it for retry behavior
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.isConnected = false;
                this.isInRoom = false;
            });

            // Game events
            this.socket.on('playerJoined', (data) => {
                console.log('Player joined:', data);
                if (this.onPlayerJoinedCallback) {
                    this.onPlayerJoinedCallback(data);
                }
            });

            this.socket.on('moveMade', (data) => {
                console.log('Move made:', data);
                if (this.onMoveCallback) {
                    this.onMoveCallback(data);
                }
            });

            this.socket.on('opponentLeft', (data) => {
                console.log('Opponent left:', data);
                this.isInRoom = false;
                if (this.onOpponentLeftCallback) {
                    this.onOpponentLeftCallback(data);
                }
            });

            this.socket.on('newGameRequested', (data) => {
                console.log('New game requested');
                // Auto-accept for now
                this.socket.emit('acceptNewGame', this.roomCode);
            });

            this.socket.on('gameReset', (data) => {
                console.log('Game reset');
                if (this.onGameResetCallback) {
                    this.onGameResetCallback(data);
                }
            });

            this.socket.on('chatMessage', (data) => {
                if (this.onChatCallback) {
                    this.onChatCallback(data);
                }
            });
        });
    }

    createRoom(settings = {}) {
        return new Promise((resolve, reject) => {
            this.socket.emit('createRoom', settings, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }

                this.roomCode = response.code;
                this.isHost = true;
                this.isInRoom = true;
                resolve(response);
            });
        });
    }

    joinRoom(code) {
        return new Promise((resolve, reject) => {
            this.socket.emit('joinRoom', code, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }

                this.roomCode = code.toUpperCase();
                this.isHost = false;
                this.isInRoom = true;
                resolve(response);
            });
        });
    }

    makeMove(row, col) {
        return new Promise((resolve, reject) => {
            this.socket.emit('move', {
                roomCode: this.roomCode,
                row,
                col
            }, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve(response);
            });
        });
    }

    requestNewGame() {
        this.socket.emit('requestNewGame', this.roomCode);
    }

    sendChat(message) {
        this.socket.emit('chat', {
            roomCode: this.roomCode,
            message
        });
    }

    leaveRoom() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.roomCode = null;
        this.isHost = false;
        this.isInRoom = false;
    }

    onMove(callback) {
        this.onMoveCallback = callback;
    }

    onGameReset(callback) {
        this.onGameResetCallback = callback;
    }

    onOpponentLeft(callback) {
        this.onOpponentLeftCallback = callback;
    }

    onPlayerJoined(callback) {
        this.onPlayerJoinedCallback = callback;
    }

    onChat(callback) {
        this.onChatCallback = callback;
    }
}

// Global instance
const onlineClient = new OnlineClient();
