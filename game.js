// ─── FACT RUNNER: LOOT & LEARN ──────────────────────────────────────────────

// DOM Elements
const mainMenu       = document.getElementById('main-menu');
const pauseMenu      = document.getElementById('pause-menu');
const gameOverScreen = document.getElementById('game-over');
const victoryScreen  = document.getElementById('victory');
const gameContainer  = document.getElementById('game-container');
const hud            = document.getElementById('hud');
const road           = document.getElementById('road');
const playerWrap     = document.getElementById('player-wrap');
const playerEl       = document.getElementById('player');
const entitiesContainer = document.getElementById('entities-container');
const livesDisplay   = document.getElementById('lives-display');
const comboDisplay   = document.getElementById('combo-display');
const scoreDisplay   = document.getElementById('score-display');
const formBadge      = document.getElementById('form-badge');
const questionDisplay= document.getElementById('question-display');
const zoneBtns       = document.querySelectorAll('.zone-btn');

const evolutionBanner = document.getElementById('evolution-banner');
const evoIcon        = document.getElementById('evo-icon');
const evoTitle       = document.getElementById('evo-title');
const evoDesc        = document.getElementById('evo-desc');

const hudPauseBtn    = document.getElementById('hud-pause-btn');
const resumeBtn      = document.getElementById('resume-btn');
const pauseRestartBtn= document.getElementById('pause-restart-btn');
const pauseMenuBtn   = document.getElementById('pause-menu-btn');

// ─── SCORING CONSTANTS ────────────────────────────────────────────────────────
const BASE_POINTS        = 100;   // points per correct answer
const COMBO_BONUS_PER    = 25;    // extra points per combo level

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const HORIZON_Y_FRAC = 0.25;
const PLAYER_BOTTOM_PX = 25;

function getLaneScreenX(lane, progress = 1) {
    const cx = window.innerWidth / 2;
    const maxSpread = Math.min(window.innerWidth * 0.16, 170);
    const spreadFactor = 0.4 + progress * 0.6;
    const currentSpread = maxSpread * spreadFactor;
    return cx + (lane - 1) * currentSpread;
}

// ─── GAME STATE ───────────────────────────────────────────────────────────────
let currentZone    = 'mathematics';
let lives          = 5;
let partsCollected = 0;
let currentLane    = 1;
let isRunning      = false;
let isPaused       = false;
let gameSpeed      = 3.5;
let activeEntities = [];
let currentQuestion = null;
let spawnTimer     = 0;
let questionMode   = false;
let totalKnowledge = 0;
let isJumping      = false;
let correctCombo   = 0;
let rafId          = null;
let currentForm    = 'box';

// ─── SCORE & HIGH SCORE STATE ─────────────────────────────────────────────────
let currentScore   = 0;
let highScore      = parseInt(localStorage.getItem('factRunnerHighScore') || '0');
totalKnowledge     = parseInt(localStorage.getItem('vantorParts') || '0');

// ─── NON-REPEATING QUESTION DECK ─────────────────────────────────────────────
// Maintains a shuffled deck per zone; refills when exhausted
let questionDecks = {};

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getNextQuestion(zone) {
    // For 'randomized' pick random zone
    let resolvedZone = zone;
    if (zone === 'randomized') {
        const keys = Object.keys(questions);
        resolvedZone = keys[Math.floor(Math.random() * keys.length)];
    }

    // Build or refill the deck for this zone
    if (!questionDecks[resolvedZone] || questionDecks[resolvedZone].length === 0) {
        questionDecks[resolvedZone] = shuffleArray(questions[resolvedZone]);
    }

    return questionDecks[resolvedZone].pop();
}

// ─── UPDATE HIGH SCORE DISPLAY ON MENU ───────────────────────────────────────
function refreshMenuHighScore() {
    const el = document.getElementById('menu-high-score');
    if (el) el.textContent = highScore.toLocaleString();
}
refreshMenuHighScore();

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
zoneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        zoneBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        currentZone = btn.dataset.zone;
    });
});

document.getElementById('start-btn').addEventListener('click', startGame);

document.getElementById('restart-btn').addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startGame();
});
document.getElementById('go-menu-btn').addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    refreshMenuHighScore();
});
document.getElementById('main-menu-btn').addEventListener('click', () => {
    victoryScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    refreshMenuHighScore();
});

if (hudPauseBtn) hudPauseBtn.addEventListener('click', togglePause);
if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
if (pauseRestartBtn) {
    pauseRestartBtn.addEventListener('click', () => {
        pauseMenu.classList.add('hidden');
        isPaused = false;
        startGame();
    });
}
if (pauseMenuBtn) {
    pauseMenuBtn.addEventListener('click', () => {
        pauseMenu.classList.add('hidden');
        isPaused = false;
        isRunning = false;
        gameContainer.classList.add('hidden');
        hud.classList.add('hidden');
        mainMenu.classList.remove('hidden');
        refreshMenuHighScore();
    });
}

window.addEventListener('resize', () => {
    if (isRunning) updatePlayerPosition();
});

// ─── KEYBOARD & TOUCH CONTROLS ────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') {
        if (isRunning) { togglePause(); return; }
    }
    if (!isRunning || isPaused) return;
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') moveLeft();
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') doJump();
});

function togglePause() { isPaused ? resumeGame() : pauseGame(); }

function pauseGame() {
    if (!isRunning) return;
    isPaused = true;
    road.classList.remove('moving');
    pauseMenu.classList.remove('hidden');
}

function resumeGame() {
    if (!isRunning) return;
    isPaused = false;
    pauseMenu.classList.add('hidden');
    road.classList.add('moving');
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
}

function moveLeft()  { if (currentLane > 0) { currentLane--; updatePlayerPosition(); } }
function moveRight() { if (currentLane < 2) { currentLane++; updatePlayerPosition(); } }

let touchStartX = 0, touchStartY = 0;
window.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', e => {
    if (!isRunning || isPaused) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -30) moveLeft();
        if (dx >  30) moveRight();
    } else if (dy < -30) doJump();
}, { passive: true });

// ─── PLAYER ───────────────────────────────────────────────────────────────────
function updatePlayerPosition() {
    const x = getLaneScreenX(currentLane, 1) - 30;
    playerWrap.style.left = `${x}px`;
}

function doJump() {
    if (isJumping) return;
    isJumping = true;
    playerEl.classList.add('jumping');
    setTimeout(() => { isJumping = false; playerEl.classList.remove('jumping'); }, 550);
}

// ─── CHARACTER EVOLUTION SYSTEM ──────────────────────────────────────────────
function updateCharacterForm() {
    let newForm = 'box';
    if (correctCombo >= 10) newForm = 'human';
    else if (correctCombo >= 5) newForm = 'robot';

    if (newForm !== currentForm) {
        currentForm = newForm;
        showEvolutionBanner(currentForm);
    }

    playerEl.className = `form-${currentForm}`;

    const badges = { box: ['box-badge', '📦 BOX'], robot: ['robot-badge', '🤖 ROBOT'], human: ['human-badge', '🧍 HUMAN'] };
    const [cls, label] = badges[currentForm];
    formBadge.className = `form-badge ${cls}`;
    formBadge.textContent = label;
}

function showEvolutionBanner(form) {
    const data = {
        robot: ['🤖', 'ROBOT UNLOCKED!', '5x Combo reached! Vantor converted into Robot Mode!'],
        human: ['🧍', 'HUMAN TRANSFORMED!', '10x Combo streak! Vantor fully restored into Human!']
    };
    if (!data[form]) return;
    const [icon, title, desc] = data[form];
    evoIcon.textContent = icon; evoTitle.textContent = title; evoDesc.textContent = desc;
    evolutionBanner.classList.remove('hidden');
    evolutionBanner.style.animation = 'none';
    evolutionBanner.offsetHeight;
    evolutionBanner.style.animation = 'evoBannerPop 2.2s cubic-bezier(0.175,0.885,0.32,1.275) forwards';
    setTimeout(() => evolutionBanner.classList.add('hidden'), 2200);
}

// ─── SCORE POPUP ANIMATION ────────────────────────────────────────────────────
function showScorePopup(points, x, y) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${points}`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    document.getElementById('scene').appendChild(popup);
    setTimeout(() => popup.remove(), 900);
}

// ─── GAME START ───────────────────────────────────────────────────────────────
function startGame() {
    mainMenu.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    hud.classList.remove('hidden');
    road.classList.add('moving');

    lives = 5; partsCollected = 0; currentLane = 1;
    gameSpeed = 3.5; activeEntities = []; spawnTimer = 0;
    questionMode = false; currentQuestion = null;
    correctCombo = 0; isJumping = false; isPaused = false;
    currentForm = 'box'; currentScore = 0;

    // Reset decks so no questions repeat in the new run
    questionDecks = {};

    entitiesContainer.innerHTML = '';
    questionDisplay.classList.add('hidden');

    updatePlayerPosition();
    updateCharacterForm();
    updateHUD();

    isRunning = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
}

// ─── ENTITIES & 3D PATH POSITIONING ─────────────────────────────────────────
function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3);
    const el = document.createElement('div');
    el.className = 'entity obstacle';
    el.innerHTML = `<span>🚧</span>`;
    entitiesContainer.appendChild(el);
    activeEntities.push({ el, lane, type: 'obstacle', progress: 0 });
}

function spawnQuestionGates() {
    questionMode = true;
    currentQuestion = getNextQuestion(currentZone);
    questionDisplay.textContent = `❓ ${currentQuestion.question}`;
    questionDisplay.classList.remove('hidden');

    const shuffledLanes = [0, 1, 2].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 3; i++) {
        const el = document.createElement('div');
        el.className = 'entity gate';
        const targetLane = shuffledLanes[i];
        const laneTag = targetLane === 0 ? '◀ LEFT' : targetLane === 1 ? '▲ CENTER' : 'RIGHT ▶';
        el.innerHTML = `<span class="gate-lane-tag">${laneTag}</span><span class="gate-text">${currentQuestion.options[i]}</span>`;

        const correct = (i === currentQuestion.answer);
        if (correct) el.dataset.correct = 'true';

        entitiesContainer.appendChild(el);
        activeEntities.push({ el, lane: targetLane, type: 'gate', progress: 0, correct });
    }
}

function positionEntity(ent) {
    const sceneH = document.getElementById('scene').offsetHeight;
    const p = Math.max(0, Math.min(1, ent.progress));
    const topHorizonBottomPx = sceneH * (1 - HORIZON_Y_FRAC);
    const entityBottom = topHorizonBottomPx - p * (topHorizonBottomPx - PLAYER_BOTTOM_PX);
    const entityCX = getLaneScreenX(ent.lane, p);
    const scale = 0.45 + p * 0.55;
    const baseW = ent.type === 'gate' ? 105 : 75;
    const baseH = ent.type === 'gate' ? 70  : 65;
    const w = baseW * scale;
    const h = baseH * scale;
    ent.el.style.width       = `${w}px`;
    ent.el.style.height      = `${h}px`;
    ent.el.style.left        = `${entityCX - w / 2}px`;
    ent.el.style.bottom      = `${entityBottom}px`;
    ent.el.style.fontSize    = `${scale * 0.95}rem`;
    ent.el.style.borderWidth = `${Math.max(2, Math.round(scale * 3))}px`;
    ent.el.style.opacity     = p < 0.04 ? (p / 0.04) : 1;
}

// ─── HUD UPDATE ───────────────────────────────────────────────────────────────
function updateHUD() {
    livesDisplay.textContent = '❤️'.repeat(Math.max(0, lives));
    comboDisplay.textContent = `Combo: x${correctCombo}`;
    if (scoreDisplay) scoreDisplay.textContent = currentScore.toLocaleString();
    updateCharacterForm();

    for (let i = 0; i < 5; i++) {
        const partEl = document.getElementById(`part-${i}`);
        if (partEl) {
            const isCollected = i < (partsCollected % 5 === 0 && partsCollected > 0 ? 5 : partsCollected % 5);
            partEl.classList.toggle('collected', isCollected);
        }
    }
}

// ─── DAMAGE & COLLECTION ──────────────────────────────────────────────────────
function takeDamage() {
    lives--;
    correctCombo = 0;
    updateCharacterForm();
    updateHUD();
    playerEl.classList.add('hit');
    setTimeout(() => playerEl.classList.remove('hit'), 300);
    if (lives <= 0) endGame();
}

function collectPart(gateEl) {
    partsCollected++;
    totalKnowledge++;
    correctCombo++;
    localStorage.setItem('vantorParts', totalKnowledge);

    // Award points: base + combo bonus
    const points = BASE_POINTS + (correctCombo - 1) * COMBO_BONUS_PER;
    currentScore += points;

    // Show floating +points popup near gate
    if (gateEl) {
        const rect = gateEl.getBoundingClientRect();
        const scene = document.getElementById('scene').getBoundingClientRect();
        showScorePopup(points, rect.left - scene.left + rect.width / 2, rect.top - scene.top);
    }

    updateCharacterForm();
    updateHUD();
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
function endGame() {
    isRunning = false;
    isPaused = false;
    cancelAnimationFrame(rafId);
    road.classList.remove('moving');
    gameContainer.classList.add('hidden');
    hud.classList.add('hidden');
    questionDisplay.classList.add('hidden');

    // Check & save high score
    const isNewHighScore = currentScore > highScore;
    if (isNewHighScore) {
        highScore = currentScore;
        localStorage.setItem('factRunnerHighScore', highScore);
    }

    const newHSTag = document.getElementById('new-high-score-tag');
    if (newHSTag) {
        newHSTag.classList.toggle('hidden', !isNewHighScore);
    }

    document.getElementById('go-text').innerHTML =
        `🏆 Score: <strong>${currentScore.toLocaleString()}</strong><br>` +
        `🥇 High Score: <strong>${highScore.toLocaleString()}</strong><br>` +
        `🔥 Highest Combo: <strong>x${correctCombo}</strong><br>` +
        `⭐ Parts collected: <strong>${partsCollected}</strong>`;

    gameOverScreen.classList.remove('hidden');
    refreshMenuHighScore();
}

// ─── MAIN GAME LOOP ───────────────────────────────────────────────────────────
function gameLoop() {
    if (!isRunning || isPaused) return;

    spawnTimer++;
    const effectiveSpeed = questionMode ? gameSpeed * 0.35 : gameSpeed;

    if (!questionMode && spawnTimer > 130) {
        spawnTimer = 0;
        if (Math.random() < 0.35) spawnQuestionGates();
        else spawnObstacle();
    }

    for (let i = activeEntities.length - 1; i >= 0; i--) {
        const ent = activeEntities[i];
        ent.progress += effectiveSpeed * 0.0013;
        positionEntity(ent);

        if (ent.progress > 1.08) {
            ent.el.remove();
            activeEntities.splice(i, 1);
            if (ent.type === 'gate') {
                questionMode = false;
                questionDisplay.classList.add('hidden');
                spawnTimer = 0;
            }
            continue;
        }

        // Collision detection
        if (ent.progress >= 0.94 && ent.progress <= 1.03 && ent.lane === currentLane) {
            const hit = ent;

            if (hit.type === 'gate') {
                questionMode = false;
                questionDisplay.classList.add('hidden');
                spawnTimer = 0;

                const gateEl = hit.correct ? hit.el : null;
                activeEntities.filter(e => e.type === 'gate').forEach(e => e.el.remove());
                activeEntities = activeEntities.filter(e => e.type !== 'gate');

                if (hit.correct) collectPart(gateEl);
                else takeDamage();

            } else if (hit.type === 'obstacle') {
                if (!isJumping) {
                    hit.el.remove();
                    activeEntities.splice(activeEntities.indexOf(hit), 1);
                    takeDamage();
                }
            }
            break;
        }
    }

    gameSpeed += 0.0007;
    rafId = requestAnimationFrame(gameLoop);
}
