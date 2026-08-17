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

// ─── TUTORIAL REFS ────────────────────────────────────────────────────────────
const tutorialScreen = document.getElementById('tutorial-screen');
const tutPlayBtn     = document.getElementById('tut-play-btn');
const tutSkipBtn     = document.getElementById('tut-skip-btn');
const tutNextBtn     = document.getElementById('tut-next-btn');
const tutBackBtn     = document.getElementById('tut-back-btn');

const TUT_TOTAL_STEPS = 6;
let currentTutStep = 0;

function tutGoToStep(step, direction = 'forward') {
    // Hide current slide
    const prevSlide = document.getElementById(`tut-slide-${currentTutStep}`);
    if (prevSlide) prevSlide.classList.remove('active', 'slide-back');

    currentTutStep = Math.max(0, Math.min(TUT_TOTAL_STEPS - 1, step));

    // Show new slide with direction animation
    const nextSlide = document.getElementById(`tut-slide-${currentTutStep}`);
    if (nextSlide) {
        nextSlide.classList.remove('active', 'slide-back');
        void nextSlide.offsetWidth; // reflow
        if (direction === 'back') nextSlide.classList.add('slide-back');
        nextSlide.classList.add('active');
    }

    // Update dots
    document.querySelectorAll('.tut-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentTutStep);
    });

    // Back button visibility
    if (tutBackBtn) tutBackBtn.style.opacity = currentTutStep === 0 ? '0.3' : '1';
    if (tutBackBtn) tutBackBtn.style.pointerEvents = currentTutStep === 0 ? 'none' : 'auto';

    // Next/Play visibility — last step hides Next
    const isLastStep = currentTutStep === TUT_TOTAL_STEPS - 1;
    if (tutNextBtn) tutNextBtn.style.display = isLastStep ? 'none' : '';
}

function showTutorial() {
    mainMenu.classList.add('hidden');
    if (tutorialScreen) {
        tutorialScreen.classList.remove('hidden');
        currentTutStep = -1; // force fresh render
        tutGoToStep(0);
    }
}

function closeTutorial() {
    if (tutorialScreen) tutorialScreen.classList.add('hidden');
}

// ─── SCORING CONSTANTS ────────────────────────────────────────────────────────
const BASE_POINTS        = 100;   // points per correct answer
const COMBO_BONUS_PER    = 25;    // extra points per combo level

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const HORIZON_Y_FRAC = 0.44; // Exit door threshold base (56% from screen bottom)
const PLAYER_BOTTOM_PX = 22;

function getLaneScreenX(lane, progress = 1) {
    const cx = window.innerWidth / 2;
    const roadEl = document.getElementById('road');
    const roadW = roadEl ? roadEl.offsetWidth : Math.min(window.innerWidth * 0.68, 820);
    
    // Polygon clip-path geometry: 10% width ratio at door threshold (p=0), 100% at player feet (p=1)
    const pDepth = Math.pow(Math.max(0, Math.min(1, progress)), 1.25);
    const polySpreadFactor = 0.10 + pDepth * 0.90;
    const maxSpread = (roadW * 0.335) * polySpreadFactor;
    return cx + (lane - 1) * maxSpread;
}

// ─── GAME STATE ───────────────────────────────────────────────────────────────
let currentZone    = 'mathematics';
let lives          = 5;
let partsCollected = 0;
let targetLane     = 1;         // 0: LEFT (-X), 1: CENTER (0), 2: RIGHT (+X)
let playerVisualLane = 1.0;     // Interpolated lane position (0.0 to 2.0)
let isRunning      = false;
let isPaused       = false;
let gameSpeed      = 3.5;
let activeEntities = [];
let currentQuestion = null;
let spawnTimer     = 0;
let questionMode   = false;
let lastQuestionTime = 0;
let totalKnowledge = 0;
let isJumping      = false;
let correctCombo   = 0;
let formStreak     = 0;
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
    let resolvedZone = zone;
    if (zone === 'randomized') {
        const keys = Object.keys(questions);
        resolvedZone = keys[Math.floor(Math.random() * keys.length)];
    }

    if (!questionDecks[resolvedZone] || questionDecks[resolvedZone].length === 0) {
        questionDecks[resolvedZone] = shuffleArray(questions[resolvedZone]);
    }

    return questionDecks[resolvedZone].pop();
}

function refreshMenuHighScore() {
    const el = document.getElementById('menu-high-score');
    if (el) el.textContent = highScore.toLocaleString();
}
refreshMenuHighScore();

zoneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        zoneBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        currentZone = btn.dataset.zone;
    });
});

document.getElementById('start-btn').addEventListener('click', () => {
    const hasSeenTutorial = localStorage.getItem('factRunnerTutorialSeen');
    if (!hasSeenTutorial) {
        localStorage.setItem('factRunnerTutorialSeen', '1');
        showTutorial();
    } else {
        startGame();
    }
});

if (tutPlayBtn) tutPlayBtn.addEventListener('click', () => { closeTutorial(); startGame(); });
if (tutSkipBtn) tutSkipBtn.addEventListener('click', () => {
    closeTutorial();
    mainMenu.classList.remove('hidden');
});
if (tutNextBtn) tutNextBtn.addEventListener('click', () => {
    if (currentTutStep < TUT_TOTAL_STEPS - 1) tutGoToStep(currentTutStep + 1, 'forward');
});
if (tutBackBtn) tutBackBtn.addEventListener('click', () => {
    if (currentTutStep > 0) tutGoToStep(currentTutStep - 1, 'back');
});

document.querySelectorAll('.tut-dot').forEach((dot, idx) => {
    dot.addEventListener('click', () => {
        const dir = idx > currentTutStep ? 'forward' : 'back';
        tutGoToStep(idx, dir);
    });
    dot.style.cursor = 'pointer';
});

const tutorialBtn = document.getElementById('tutorial-btn');
if (tutorialBtn) tutorialBtn.addEventListener('click', showTutorial);



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
    if (isRunning) {
        updatePlayerPosition();
        activeEntities.forEach(ent => positionEntity(ent));
    }
});

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
    // Populate pause stats
    const pScore = document.getElementById('pause-score');
    const pCombo = document.getElementById('pause-combo');
    const pLives = document.getElementById('pause-lives');
    if (pScore) pScore.textContent = currentScore.toLocaleString();
    if (pCombo) pCombo.textContent = correctCombo;
    if (pLives) pLives.textContent = lives;
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

function moveLeft()  { if (targetLane > 0) targetLane--; }
function moveRight() { if (targetLane < 2) targetLane++; }

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

function updatePlayerPosition() {
    const x = getLaneScreenX(playerVisualLane, 1) - 30;
    playerWrap.style.left = `${x}px`;
}

function doJump() {
    if (isJumping) return;
    isJumping = true;
    playerEl.classList.add('jumping');
    setTimeout(() => { isJumping = false; playerEl.classList.remove('jumping'); }, 550);
}

function updateCharacterForm() {
    playerEl.className = `form-${currentForm}`;

    const badges = {
        box: ['box-badge', '📦 BOX'],
        robot: ['robot-badge', '🤖 ROBOT'],
        human: ['human-badge', '🧍 HUMAN']
    };
    const [cls, label] = badges[currentForm] || badges.box;
    formBadge.className = `form-badge ${cls}`;
    formBadge.textContent = label;
}

function showEvolutionBanner(form) {
    const data = {
        robot: ['🤖', 'ROBOT UNLOCKED!', '5x Combo reached! Vantor converted into Robot Mode!'],
        human: ['🧍', 'HUMAN TRANSFORMED!', '5x Combo reached! Vantor fully restored into Human Student!']
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

function showScorePopup(points, x, y) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `${points}`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    document.getElementById('scene').appendChild(popup);
    setTimeout(() => popup.remove(), 900);
}

function startGame() {
    mainMenu.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    hud.classList.remove('hidden');
    road.classList.add('moving');

    lives = 5; partsCollected = 0;
    targetLane = 1; playerVisualLane = 1.0;
    gameSpeed = 3.5; activeEntities = []; spawnTimer = 0;
    questionMode = false; currentQuestion = null;
    lastQuestionTime = Date.now() - 14000;
    correctCombo = 0; formStreak = 0; isJumping = false; isPaused = false;
    currentForm = 'box'; currentScore = 0;

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

function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3);
    const types = [
        { icon: '⚠️', name: 'CAUTION', cls: 'obs-caution' },
        { icon: '🚧', name: 'BARRIER', cls: 'obs-barrier' },
        { icon: '📦', name: 'HAZARD', cls: 'obs-box' },
        { icon: '🛢️', name: 'DANGER', cls: 'obs-barrel' }
    ];
    const obsType = types[Math.floor(Math.random() * types.length)];
    const el = document.createElement('div');
    el.className = `entity obstacle ${obsType.cls}`;
    el.innerHTML = `<span class="obs-icon">${obsType.icon}</span><span class="obs-label">${obsType.name}</span><div class="obs-shadow"></div>`;
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
    const vw = window.innerWidth;
    const p = Math.max(0, Math.min(1, ent.progress));
    
    // Continuous floor Y curve: p=0 at exit door threshold (38% from bottom), p=1 at player feet (22px)
    const horizonYPx = sceneH * (1 - HORIZON_Y_FRAC);
    const pDepth = Math.pow(p, 1.25);
    const entityBottom = horizonYPx - pDepth * (horizonYPx - PLAYER_BOTTOM_PX);
    
    // Continuous floor X center following lane tracks inside the trapezoid
    const entityCX = getLaneScreenX(ent.lane, p);
    
    // Scale matches trapezoid width: 0.20 at door threshold, 1.0 at player feet
    const scale = 0.20 + pDepth * 0.80;
    
    const roadEl = document.getElementById('road');
    const roadW = roadEl ? roadEl.offsetWidth : Math.min(vw * 0.68, 820);
    const currentLaneW = (roadW * 0.335) * (0.10 + pDepth * 0.90);
    const maxEntityW = currentLaneW * 0.90;
    
    let baseW = ent.type === 'gate' ? Math.min(220, maxEntityW / scale) : Math.min(100, maxEntityW / scale);
    let baseH = ent.type === 'gate' ? Math.min(85, baseW * 0.45) : Math.min(76, baseW * 0.82);

    const w = Math.max(ent.type === 'gate' ? 40 : 34, baseW * scale);
    const h = Math.max(ent.type === 'gate' ? 30 : 28, baseH * scale);

    ent.el.style.width       = `${w}px`;
    ent.el.style.height      = `${h}px`;
    ent.el.style.left        = `${entityCX - w / 2}px`;
    ent.el.style.bottom      = `${entityBottom}px`;
    
    let fontMultiplier = ent.type === 'gate' ? 1.6 : 1.1;
    if (vw <= 480) fontMultiplier = ent.type === 'gate' ? 1.3 : 0.9;
    ent.el.style.fontSize    = `${scale * fontMultiplier}rem`;
    ent.el.style.borderWidth = `${Math.max(2, Math.round(scale * 3))}px`;
    ent.el.style.opacity     = p < 0.03 ? (p / 0.03) : 1;
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
    formStreak = 0;

    // Demotion logic on mistake/damage:
    // Human -> Robot
    // Robot -> Box
    if (currentForm === 'human') {
        currentForm = 'robot';
    } else if (currentForm === 'robot') {
        currentForm = 'box';
    }

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
    formStreak++;
    localStorage.setItem('vantorParts', totalKnowledge);

    // Evolution logic:
    // 5 consecutive correct answers as Box -> transform into Robot
    // 5 consecutive correct answers as Robot -> transform into Human Student
    if (currentForm === 'box' && formStreak >= 5) {
        currentForm = 'robot';
        formStreak = 0;
        showEvolutionBanner('robot');
    } else if (currentForm === 'robot' && formStreak >= 5) {
        currentForm = 'human';
        formStreak = 0;
        showEvolutionBanner('human');
    }

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

    // Smooth LERP player movement towards targetLane
    if (Math.abs(targetLane - playerVisualLane) > 0.001) {
        playerVisualLane += (targetLane - playerVisualLane) * 0.25;
        updatePlayerPosition();
    } else if (playerVisualLane !== targetLane) {
        playerVisualLane = targetLane;
        updatePlayerPosition();
    }

    spawnTimer++;
    const effectiveSpeed = questionMode ? gameSpeed * 0.60 : gameSpeed;
    const now = Date.now();

    if (!questionMode && spawnTimer > 120) {
        spawnTimer = 0;
        // Spawn question gates every 20 seconds (20,000 ms)
        if (now - lastQuestionTime >= 20000) {
            spawnQuestionGates();
        } else {
            spawnObstacle();
        }
    }

    for (let i = activeEntities.length - 1; i >= 0; i--) {
        const ent = activeEntities[i];
        ent.progress += effectiveSpeed * 0.0013;
        positionEntity(ent);

        if (ent.progress > 1.08) {
            if (ent.type === 'obstacle') {
                // Successfully dodged obstacle: award +10 points!
                currentScore += 10;
                updateHUD();
                const entX = getLaneScreenX(ent.lane, 1);
                const sceneRect = document.getElementById('scene').getBoundingClientRect();
                showScorePopup('⚡ +10 DODGED!', entX, sceneRect.height - 100);
            }
            ent.el.remove();
            activeEntities.splice(i, 1);
            if (ent.type === 'gate') {
                questionMode = false;
                questionDisplay.classList.add('hidden');
                spawnTimer = 0;
                lastQuestionTime = Date.now();
            }
            continue;
        }

        // Collision detection
        if (ent.progress >= 0.94 && ent.progress <= 1.03 && ent.lane === targetLane) {
            const hit = ent;

            if (hit.type === 'gate') {
                questionMode = false;
                questionDisplay.classList.add('hidden');
                spawnTimer = 0;
                lastQuestionTime = Date.now();

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
