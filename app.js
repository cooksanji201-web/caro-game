/**
 * Caro Game - Main Application
 * Supports AI mode and Online Multiplayer
 */

// App State
const state = {
    game: null,
    ai: null,
    scores: { X: 0, O: 0 },
    settings: {
        boardSize: 15,
        sound: true,
        vibration: true
    },
    timer: {
        seconds: 0,
        interval: null
    },
    isThinking: false,
    // Online mode
    mode: 'ai', // 'ai' or 'online'
    isOnline: false,
    isHost: false,
    roomCode: null,
    mySymbol: 'X'
};

// DOM Elements
const elements = {
    // Screens
    modeScreen: document.getElementById('modeScreen'),
    waitingScreen: document.getElementById('waitingScreen'),
    joinScreen: document.getElementById('joinScreen'),
    gameScreen: document.getElementById('gameScreen'),
    // Mode selection
    aiModeBtn: document.getElementById('aiModeBtn'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    // Waiting room
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    cancelWaitBtn: document.getElementById('cancelWaitBtn'),
    // Join room
    roomCodeInput: document.getElementById('roomCodeInput'),
    joinError: document.getElementById('joinError'),
    backToModeBtn: document.getElementById('backToModeBtn'),
    confirmJoinBtn: document.getElementById('confirmJoinBtn'),
    // Game
    board: document.getElementById('board'),
    turnIndicator: document.getElementById('turnIndicator'),
    scoreX: document.getElementById('scoreX'),
    scoreO: document.getElementById('scoreO'),
    playerXLabel: document.getElementById('playerXLabel'),
    playerOLabel: document.getElementById('playerOLabel'),
    timer: document.getElementById('timer'),
    newGameBtn: document.getElementById('newGameBtn'),
    undoBtn: document.getElementById('undoBtn'),
    backBtn: document.getElementById('backBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    difficultySelector: document.getElementById('difficultySelector'),
    onlineBadge: document.getElementById('onlineBadge'),
    roomCodeBadge: document.getElementById('roomCodeBadge'),
    // Modals
    winModal: document.getElementById('winModal'),
    modalIcon: document.getElementById('modalIcon'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    exitGameBtn: document.getElementById('exitGameBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    boardSizeSelect: document.getElementById('boardSizeSelect'),
    soundToggle: document.getElementById('soundToggle'),
    vibrationToggle: document.getElementById('vibrationToggle'),
    difficultyBtns: document.querySelectorAll('.difficulty-btn'),
    opponentLeftModal: document.getElementById('opponentLeftModal'),
    returnToMenuBtn: document.getElementById('returnToMenuBtn'),
    // PWA
    installBanner: document.getElementById('installBanner'),
    installBtn: document.getElementById('installBtn'),
    closeBanner: document.getElementById('closeBanner')
};

// Audio Context for sounds
let audioContext = null;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API not supported');
    }
}

function playSound(type) {
    if (!state.settings.sound || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    switch (type) {
        case 'place':
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.05);
            break;
        case 'win':
            oscillator.frequency.value = 523;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.15;
            oscillator.start();
            setTimeout(() => oscillator.frequency.value = 659, 100);
            setTimeout(() => oscillator.frequency.value = 784, 200);
            oscillator.stop(audioContext.currentTime + 0.4);
            break;
        case 'lose':
            oscillator.frequency.value = 400;
            oscillator.type = 'sawtooth';
            gainNode.gain.value = 0.1;
            oscillator.start();
            setTimeout(() => oscillator.frequency.value = 300, 150);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
    }
}

function vibrate(pattern) {
    if (state.settings.vibration && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// Screen Navigation
function showScreen(screenId) {
    [elements.modeScreen, elements.waitingScreen, elements.joinScreen, elements.gameScreen].forEach(screen => {
        if (screen) screen.classList.add('hidden');
    });

    const screen = document.getElementById(screenId);
    if (screen) screen.classList.remove('hidden');
}

// Mode Selection Handlers
async function startAIMode() {
    state.mode = 'ai';
    state.isOnline = false;
    state.mySymbol = 'X';

    elements.playerXLabel.textContent = 'Bạn';
    elements.playerOLabel.textContent = 'AI';
    elements.difficultySelector.style.display = 'flex';
    elements.onlineBadge.classList.add('hidden');
    elements.undoBtn.style.display = 'flex';

    showScreen('gameScreen');
    initGame();
}

async function createRoom() {
    try {
        await onlineClient.connect();
        const result = await onlineClient.createRoom({ size: state.settings.boardSize });

        state.roomCode = result.code;
        state.isHost = true;
        state.mySymbol = 'X';

        elements.roomCodeDisplay.textContent = result.code;
        showScreen('waitingScreen');

        // Wait for player to join
        onlineClient.onPlayerJoined(() => {
            startOnlineGame();
        });

    } catch (error) {
        console.error('Failed to create room:', error);
        alert('Không thể kết nối server. Vui lòng thử lại.');
    }
}

function showJoinScreen() {
    elements.roomCodeInput.value = '';
    elements.joinError.classList.add('hidden');
    showScreen('joinScreen');
}

async function joinRoom() {
    const code = elements.roomCodeInput.value.trim().toUpperCase();

    if (code.length !== 6) {
        elements.joinError.textContent = 'Mã phòng phải có 6 ký tự';
        elements.joinError.classList.remove('hidden');
        return;
    }

    try {
        await onlineClient.connect();
        const result = await onlineClient.joinRoom(code);

        state.roomCode = code;
        state.isHost = false;
        state.mySymbol = 'O';
        state.settings.boardSize = result.size;

        startOnlineGame();

    } catch (error) {
        elements.joinError.textContent = error.message || 'Không thể vào phòng';
        elements.joinError.classList.remove('hidden');
    }
}

function startOnlineGame() {
    state.mode = 'online';
    state.isOnline = true;

    elements.playerXLabel.textContent = state.isHost ? 'Bạn' : 'Đối thủ';
    elements.playerOLabel.textContent = state.isHost ? 'Đối thủ' : 'Bạn';
    elements.difficultySelector.style.display = 'none';
    elements.onlineBadge.classList.remove('hidden');
    elements.roomCodeBadge.textContent = state.roomCode;
    elements.undoBtn.style.display = 'none';

    showScreen('gameScreen');
    initGame();

    // Setup online event handlers
    setupOnlineHandlers();
}

function setupOnlineHandlers() {
    onlineClient.onMove((data) => {
        // Update board from opponent's move
        updateCell(data.row, data.col, data.player);
        playSound('place');

        if (data.gameOver) {
            if (data.winner === 'draw') {
                handleDraw();
            } else {
                handleWin(data.winner, data.winningCells);
            }
        } else {
            // Update turn
            state.game.currentPlayer = data.nextPlayer;
            updateTurnIndicator();
        }
    });

    onlineClient.onGameReset(() => {
        newGame();
    });

    onlineClient.onOpponentLeft(() => {
        showModal(elements.opponentLeftModal);
    });
}

function cancelWaiting() {
    onlineClient.leaveRoom();
    showScreen('modeScreen');
}

function returnToMenu() {
    hideModal(elements.opponentLeftModal);
    onlineClient.leaveRoom();
    state.isOnline = false;
    state.roomCode = null;
    showScreen('modeScreen');
}

// Initialize Game
function initGame() {
    state.game = new CaroGame(state.settings.boardSize);
    state.ai = new CaroAI('medium');
    state.isThinking = false;

    renderBoard();
    updateTurnIndicator();
    resetTimer();
    startTimer();
}

// Render Board
function renderBoard() {
    elements.board.innerHTML = '';
    elements.board.style.gridTemplateColumns = `repeat(${state.game.size}, var(--cell-size))`;

    for (let row = 0; row < state.game.size; row++) {
        for (let col = 0; col < state.game.size; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleCellClick(row, col));
            elements.board.appendChild(cell);
        }
    }
}

// Handle Cell Click
function handleCellClick(row, col) {
    if (state.game.gameOver || state.isThinking) return;
    if (state.game.board[row][col] !== null) return;

    // Check if it's my turn
    if (state.isOnline) {
        const isMyTurn = (state.mySymbol === state.game.currentPlayer);
        if (!isMyTurn) return;
    } else {
        if (state.game.currentPlayer !== 'X') return;
    }

    // Initialize audio on first interaction
    if (!audioContext) initAudio();

    if (state.isOnline) {
        // Online mode - send move to server
        onlineClient.makeMove(row, col).catch(err => {
            console.error('Move failed:', err);
        });
    } else {
        // AI mode - make move locally
        const result = state.game.makeMove(row, col);
        if (!result) return;

        updateCell(row, col, 'X');
        playSound('place');
        vibrate(10);

        if (result.win) {
            handleWin('X', result.cells);
            return;
        }

        if (result.draw) {
            handleDraw();
            return;
        }

        // AI turn
        updateTurnIndicator();
        makeAIMove();
    }
}

// AI Move
async function makeAIMove() {
    state.isThinking = true;
    updateTurnIndicator();

    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));

    const move = state.ai.getMove(state.game);
    const result = state.game.makeMove(move.row, move.col);

    updateCell(move.row, move.col, 'O');
    playSound('place');

    state.isThinking = false;

    if (result.win) {
        handleWin('O', result.cells);
        return;
    }

    if (result.draw) {
        handleDraw();
        return;
    }

    updateTurnIndicator();
}

// Update Cell Display
function updateCell(row, col, player) {
    const cell = elements.board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;

    cell.classList.add('taken', player.toLowerCase());
    cell.textContent = player === 'X' ? '✕' : '○';

    // Remove last-move class from all cells
    elements.board.querySelectorAll('.last-move').forEach(c => c.classList.remove('last-move'));
    cell.classList.add('last-move');
}

// Handle Win
function handleWin(winner, cells) {
    stopTimer();

    // Highlight winning cells
    if (cells) {
        cells.forEach(({ row, col }) => {
            const cell = elements.board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) cell.classList.add('winning');
        });
    }

    // Update score
    state.scores[winner]++;
    updateScores();

    // Determine if I won
    const iWon = state.isOnline ? (winner === state.mySymbol) : (winner === 'X');

    if (iWon) {
        elements.modalIcon.textContent = '🎉';
        elements.modalTitle.textContent = 'Chiến thắng!';
        elements.modalMessage.textContent = state.isOnline ? 'Bạn đã đánh bại đối thủ!' : 'Chúc mừng! Bạn đã đánh bại AI!';
        playSound('win');
        vibrate([50, 50, 50, 50, 100]);
    } else {
        elements.modalIcon.textContent = state.isOnline ? '😢' : '🤖';
        elements.modalTitle.textContent = state.isOnline ? 'Thua cuộc!' : 'AI Thắng!';
        elements.modalMessage.textContent = state.isOnline ? 'Đối thủ đã chiến thắng. Thử lại nhé!' : 'AI đã chiến thắng. Thử lại nhé!';
        playSound('lose');
        vibrate([100, 50, 100]);
    }

    setTimeout(() => showModal(elements.winModal), 500);
}

// Handle Draw
function handleDraw() {
    stopTimer();

    elements.modalIcon.textContent = '🤝';
    elements.modalTitle.textContent = 'Hòa!';
    elements.modalMessage.textContent = 'Trận đấu kết thúc hòa!';

    setTimeout(() => showModal(elements.winModal), 300);
}

// Update Turn Indicator
function updateTurnIndicator() {
    const indicator = document.querySelector('.turn-indicator');
    const symbol = indicator.querySelector('.turn-symbol');
    const text = indicator.querySelector('.turn-text');

    indicator.classList.remove('player-x', 'player-o');

    const currentPlayer = state.game.currentPlayer;
    const isMyTurn = state.isOnline ? (currentPlayer === state.mySymbol) : (currentPlayer === 'X');

    if (currentPlayer === 'X') {
        indicator.classList.add('player-x');
        symbol.textContent = '✕';
    } else {
        indicator.classList.add('player-o');
        symbol.textContent = '○';
    }

    if (state.isOnline) {
        text.textContent = isMyTurn ? 'Lượt của bạn' : 'Lượt đối thủ';
    } else {
        if (currentPlayer === 'X') {
            text.textContent = 'Lượt của bạn';
        } else {
            text.textContent = state.isThinking ? 'AI đang suy nghĩ...' : 'Lượt của AI';
        }
    }
}

// Update Scores
function updateScores() {
    elements.scoreX.textContent = state.scores.X;
    elements.scoreO.textContent = state.scores.O;
}

// Timer
function startTimer() {
    state.timer.interval = setInterval(() => {
        state.timer.seconds++;
        const mins = Math.floor(state.timer.seconds / 60);
        const secs = state.timer.seconds % 60;
        elements.timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timer.interval);
}

function resetTimer() {
    stopTimer();
    state.timer.seconds = 0;
    elements.timer.textContent = '00:00';
}

// Modal Controls
function showModal(modal) {
    modal.classList.add('active');
}

function hideModal(modal) {
    modal.classList.remove('active');
}

// New Game
function newGame() {
    hideModal(elements.winModal);
    state.game.reset();
    state.isThinking = false;

    // Clear board UI
    elements.board.querySelectorAll('.cell').forEach(cell => {
        cell.className = 'cell';
        cell.textContent = '';
    });

    updateTurnIndicator();
    resetTimer();
    startTimer();

    if (state.isOnline) {
        onlineClient.requestNewGame();
    }
}

// Exit Game
function exitGame() {
    hideModal(elements.winModal);
    if (state.isOnline) {
        onlineClient.leaveRoom();
        state.isOnline = false;
        state.roomCode = null;
    }
    showScreen('modeScreen');
}

// Undo Move
function undoMove() {
    if (state.isOnline) return; // No undo in online mode
    if (state.isThinking || state.game.moveHistory.length === 0) return;

    const success = state.game.undoMove();
    if (!success) return;

    // Refresh board UI
    elements.board.querySelectorAll('.cell').forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const value = state.game.board[row][col];

        cell.className = 'cell';
        cell.textContent = '';

        if (value) {
            cell.classList.add('taken', value.toLowerCase());
            cell.textContent = value === 'X' ? '✕' : '○';
        }
    });

    // Mark last move
    const lastMove = state.game.getLastMove();
    if (lastMove) {
        const cell = elements.board.querySelector(`[data-row="${lastMove.row}"][data-col="${lastMove.col}"]`);
        if (cell) cell.classList.add('last-move');
    }

    updateTurnIndicator();
}

// Settings
function loadSettings() {
    const saved = localStorage.getItem('caroSettings');
    if (saved) {
        Object.assign(state.settings, JSON.parse(saved));
    }

    elements.boardSizeSelect.value = state.settings.boardSize;
    elements.soundToggle.checked = state.settings.sound;
    elements.vibrationToggle.checked = state.settings.vibration;
}

function saveSettings() {
    state.settings.boardSize = parseInt(elements.boardSizeSelect.value);
    state.settings.sound = elements.soundToggle.checked;
    state.settings.vibration = elements.vibrationToggle.checked;

    localStorage.setItem('caroSettings', JSON.stringify(state.settings));

    hideModal(elements.settingsModal);
}

// Difficulty Selection
function handleDifficultyChange(e) {
    if (!e.target.classList.contains('difficulty-btn')) return;

    elements.difficultyBtns.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');

    const level = e.target.dataset.level;
    state.ai.setDifficulty(level);
}

// Copy Room Code
function copyRoomCode() {
    navigator.clipboard.writeText(state.roomCode).then(() => {
        elements.copyCodeBtn.innerHTML = '✓';
        setTimeout(() => {
            elements.copyCodeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>`;
        }, 2000);
    });
}

// PWA Install
let deferredPrompt = null;

function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show install banner after a delay
        setTimeout(() => {
            if (!localStorage.getItem('pwaInstallDismissed')) {
                elements.installBanner.classList.add('show');
            }
        }, 3000);
    });

    elements.installBtn?.addEventListener('click', async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            elements.installBanner.classList.remove('show');
        }
        deferredPrompt = null;
    });

    elements.closeBanner?.addEventListener('click', () => {
        elements.installBanner.classList.remove('show');
        localStorage.setItem('pwaInstallDismissed', 'true');
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
}

// Event Listeners
function setupEventListeners() {
    // Mode selection
    elements.aiModeBtn?.addEventListener('click', startAIMode);
    elements.createRoomBtn?.addEventListener('click', createRoom);
    elements.joinRoomBtn?.addEventListener('click', showJoinScreen);

    // Waiting room
    elements.copyCodeBtn?.addEventListener('click', copyRoomCode);
    elements.cancelWaitBtn?.addEventListener('click', cancelWaiting);

    // Join room
    elements.backToModeBtn?.addEventListener('click', () => showScreen('modeScreen'));
    elements.confirmJoinBtn?.addEventListener('click', joinRoom);
    elements.roomCodeInput?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') joinRoom();
    });

    // Game controls
    elements.newGameBtn?.addEventListener('click', newGame);
    elements.undoBtn?.addEventListener('click', undoMove);
    elements.playAgainBtn?.addEventListener('click', newGame);
    elements.exitGameBtn?.addEventListener('click', exitGame);
    elements.backBtn?.addEventListener('click', exitGame);

    // Settings
    elements.settingsBtn?.addEventListener('click', () => showModal(elements.settingsModal));
    elements.closeSettingsBtn?.addEventListener('click', () => hideModal(elements.settingsModal));
    elements.saveSettingsBtn?.addEventListener('click', saveSettings);

    // Difficulty
    document.querySelector('.difficulty-options')?.addEventListener('click', handleDifficultyChange);

    // Opponent left
    elements.returnToMenuBtn?.addEventListener('click', returnToMenu);

    // Close modals on backdrop click
    [elements.winModal, elements.settingsModal, elements.opponentLeftModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal(elements.winModal);
            hideModal(elements.settingsModal);
        }
        if (e.key === 'n' && e.ctrlKey) {
            e.preventDefault();
            newGame();
        }
        if (e.key === 'z' && e.ctrlKey && !state.isOnline) {
            e.preventDefault();
            undoMove();
        }
    });
}

// Initialize App
function init() {
    loadSettings();
    setupEventListeners();
    setupPWA();
    showScreen('modeScreen');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
