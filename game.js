// ─── FACT RUNNER: LOOT & LEARN ──────────────────────────────────────────────

// DOM
const mainMenu      = document.getElementById('main-menu');
const gameOverScreen= document.getElementById('game-over');
const victoryScreen = document.getElementById('victory');
const gameContainer = document.getElementById('game-container');
const hud           = document.getElementById('hud');
const road          = document.getElementById('road');
const playerWrap    = document.getElementById('player-wrap');
const playerEl      = document.getElementById('player');
const entitiesContainer = document.getElementById('entities-container');
const livesDisplay  = document.getElementById('lives-display');
const comboDisplay  = document.getElementById('combo-display');
const questionDisplay = document.getElementById('question-display');
const zoneBtns      = document.querySelectorAll('.zone-btn');

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

// #scene is 60% of viewport height, positioned at bottom.
// Entities-container covers full scene width/height.
// We project from horizon (top of scene) → player (bottom of scene).

// How far from the LEFT EDGE of the screen each lane centre sits (in px).
// Computed dynamically from window.innerWidth so it always centred on road.
function getLaneScreenX(lane) {
    const cx = window.innerWidth / 2; // road centre x in screen
    const spread = Math.min(window.innerWidth * 0.14, 130); // how far lanes spread
    return cx + (lane - 1) * spread; // lane 0=left, 1=centre, 2=right
}

// Player sits at this Y from the BOTTOM of the scene (px)
const PLAYER_BOTTOM_PX = 45;
// Horizon is this fraction from TOP of the scene
const HORIZON_FRAC = 0.02;

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentZone   = 'mathematics';
let lives         = 5;
let partsCollected= 0;
let currentLane   = 1;
let isRunning     = false;
let gameSpeed     = 3.5;
let activeEntities= [];
let currentQuestion = null;
let spawnTimer    = 0;
let questionMode  = false;
let totalKnowledge= 0;
let isJumping     = false;
let correctCombo  = 0;
let rafId         = null;
let buildingTimer = 0;

// LocalStorage
totalKnowledge = parseInt(localStorage.getItem('vantorParts') || '0');

// ─── ZONE SELECTION ───────────────────────────────────────────────────────────
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
});
document.getElementById('main-menu-btn').addEventListener('click', () => {
    victoryScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});

// ─── CONTROLS ─────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    if (!isRunning) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (currentLane > 0) { currentLane--; updatePlayerPosition(); }
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (currentLane < 2) { currentLane++; updatePlayerPosition(); }
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        doJump();
    }
});

// Swipe / touch support
let touchStartX = 0, touchStartY = 0;
window.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchend', e => {
    if (!isRunning) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -30 && currentLane > 0) { currentLane--; updatePlayerPosition(); }
        if (dx >  30 && currentLane < 2) { currentLane++; updatePlayerPosition(); }
    } else if (dy < -30) {
        doJump();
    }
}, { passive: true });

// ─── PLAYER ───────────────────────────────────────────────────────────────────
function updatePlayerPosition() {
    // Player wrap is inside #scene (position:absolute, left:0, width:100%)
    // So we set left in screen pixel coords directly
    const x = getLaneScreenX(currentLane) - 26; // 26 = half player width (52px / 2)
    playerWrap.style.left = `${x}px`;
}

function doJump() {
    if (isJumping) return;
    isJumping = true;
    playerEl.classList.add('jumping');
    playerEl.querySelector('.leg').style.animationPlayState = 'paused';
    playerEl.querySelectorAll('.leg')[1].style.animationPlayState = 'paused';
    setTimeout(() => {
        isJumping = false;
        playerEl.classList.remove('jumping');
        playerEl.querySelectorAll('.leg').forEach(l => l.style.animationPlayState = '');
    }, 550);
}

// ─── GAME START ───────────────────────────────────────────────────────────────
function startGame() {
    mainMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    hud.classList.remove('hidden');
    road.classList.add('moving');

    lives = 5; partsCollected = 0; currentLane = 1;
    gameSpeed = 3.5; activeEntities = []; spawnTimer = 0;
    questionMode = false; currentQuestion = null;
    correctCombo = 0; isJumping = false; buildingTimer = 0;

    entitiesContainer.innerHTML = '';
    document.getElementById('buildings-left').innerHTML = '';
    document.getElementById('buildings-right').innerHTML = '';

    questionDisplay.classList.add('hidden');
    playerEl.className = '';

    updatePlayerPosition();
    updateHUD();

    isRunning = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
}

// ─── QUESTIONS ────────────────────────────────────────────────────────────────
function getRandomQuestion() {
    let pool = questions[currentZone];
    if (currentZone === 'randomized') {
        const keys = Object.keys(questions);
        pool = questions[keys[Math.floor(Math.random() * keys.length)]];
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

// ─── ENTITY CREATION ─────────────────────────────────────────────────────────
// Entities live in screen space. We simulate perspective by scaling them
// smaller when they're near the top (horizon) and larger near the bottom (player).
// progress: 0 = just spawned at horizon, 1 = at player level
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
    currentQuestion = getRandomQuestion();
    questionDisplay.textContent = `❓ ${currentQuestion.question}`;
    questionDisplay.classList.remove('hidden');

    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 3; i++) {
        const el = document.createElement('div');
        el.className = 'entity gate';
        el.textContent = currentQuestion.options[i];
        const correct = (i === currentQuestion.answer);
        if (correct) el.dataset.correct = 'true';
        entitiesContainer.appendChild(el);
        activeEntities.push({ el, lane: lanes[i], type: 'gate', progress: 0, correct });
    }
}

function positionEntity(ent) {
    const sceneH  = document.getElementById('scene').offsetHeight;
    const p       = Math.max(0, Math.min(1, ent.progress));

    // ── VERTICAL ──────────────────────────────────────────────────
    // At p=0: entity is near top of scene (horizon) → large bottom value
    // At p=1: entity is near bottom (player level) → small bottom value
    const horizonPx = sceneH * HORIZON_FRAC;          // px from top of scene
    const topBottomPx = sceneH - horizonPx;            // as "bottom" value
    const entityBottom = PLAYER_BOTTOM_PX + (1 - p) * (topBottomPx - PLAYER_BOTTOM_PX);

    // ── SCALE ─────────────────────────────────────────────────────
    const minScale = 0.05;
    const maxScale = 0.95;
    const scale    = minScale + p * (maxScale - minScale);

    const baseW = ent.type === 'gate' ? 120 : 80;
    const baseH = ent.type === 'gate' ? 68  : 68;
    const w = baseW * scale;
    const h = baseH * scale;

    // ── HORIZONTAL ────────────────────────────────────────────────
    // entities-container covers full screen width.
    // At p=0 (horizon) → centre of screen.
    // At p=1 (player)  → lane's screen position.
    const centreX   = window.innerWidth / 2;
    const laneX     = getLaneScreenX(ent.lane);
    const entityCX  = centreX + p * (laneX - centreX); // interpolate
    const entityLeft= entityCX - w / 2;

    ent.el.style.width       = `${w}px`;
    ent.el.style.height      = `${h}px`;
    ent.el.style.left        = `${entityLeft}px`;
    ent.el.style.bottom      = `${entityBottom}px`;
    ent.el.style.fontSize    = `${Math.max(0.45, scale * 0.9)}rem`;
    ent.el.style.borderWidth = `${Math.max(1, Math.round(scale * 3))}px`;
    ent.el.style.opacity     = p < 0.07 ? (p / 0.07) : 1;
}


// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateHUD() {
    livesDisplay.textContent = '❤️'.repeat(Math.max(0, lives));

    for (let i = 0; i < 5; i++) {
        document.getElementById(`part-${i}`).classList.toggle('collected', i < (partsCollected % 5 === 0 && partsCollected > 0 ? 5 : partsCollected % 5));
    }

    comboDisplay.textContent = `Combo: ${correctCombo}`;
    comboDisplay.classList.toggle('combo-high', correctCombo >= 3);

    // Robot mode
    if (correctCombo >= 3) {
        playerEl.classList.add('robot');
    } else {
        playerEl.classList.remove('robot');
    }

    // Glow based on parts
    const gp = Math.min(partsCollected % 6, 5);
    if (gp > 0) {
        playerEl.querySelector('.body').style.boxShadow =
            `inset -5px -5px 10px rgba(0,0,0,0.5), 0 0 ${gp*8}px ${gp*4}px rgba(16,185,129,${0.3 + gp*0.1})`;
    } else {
        playerEl.querySelector('.body').style.boxShadow = '';
    }
}

// ─── DAMAGE & COLLECT ─────────────────────────────────────────────────────────
function takeDamage() {
    lives--;
    correctCombo = 0;
    updateHUD();
    playerEl.classList.add('hit');
    setTimeout(() => playerEl.classList.remove('hit'), 300);
    if (lives <= 0) endGame();
}

function collectPart() {
    partsCollected++;
    totalKnowledge++;
    correctCombo++;
    localStorage.setItem('vantorParts', totalKnowledge);

    // Combo popup
    if (correctCombo > 1) showComboPopup();

    updateHUD();
}

function showComboPopup() {
    const old = document.getElementById('combo-popup');
    if (old) old.remove();
    const pop = document.createElement('div');
    pop.id = 'combo-popup';
    pop.textContent = correctCombo >= 3 ? `🤖 ROBOT MODE x${correctCombo}!` : `🔥 x${correctCombo} Combo!`;
    gameContainer.appendChild(pop);
    setTimeout(() => pop.remove(), 850);
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
function endGame() {
    isRunning = false;
    cancelAnimationFrame(rafId);
    road.classList.remove('moving');

    gameContainer.classList.add('hidden');
    hud.classList.add('hidden');
    questionDisplay.classList.add('hidden');

    document.getElementById('go-text').innerHTML =
        `Parts collected this run: <strong>${partsCollected}</strong><br>Total knowledge: <strong>${totalKnowledge}</strong>`;
    gameOverScreen.classList.remove('hidden');
}

// ─── BUILDINGS ────────────────────────────────────────────────────────────────
function spawnBuilding() {
    const colors = ['#1e3a5f','#1a2e4f','#0f2035','#16213e','#1a1a3e'];
    const heights= [120,150,180,200,90,130];
    const h = heights[Math.floor(Math.random() * heights.length)];
    const w = 50 + Math.floor(Math.random() * 50);
    const c = colors[Math.floor(Math.random() * colors.length)];

    ['buildings-left','buildings-right'].forEach((side, idx) => {
        const b = document.createElement('div');
        b.style.cssText = `
            position:absolute;bottom:0;${idx===0?'right:0':'left:0'};
            width:${w}px;height:${h}px;
            background:${c};
            border-top:4px solid rgba(255,255,255,0.1);
            border-${idx===0?'left':'right'}:6px solid rgba(0,0,0,0.5);
            background-image:repeating-linear-gradient(to bottom,transparent,transparent 22px,rgba(255,220,50,0.15) 22px,rgba(255,220,50,0.15) 28px);
        `;
        document.getElementById(side).appendChild(b);

        // Remove after 4 seconds
        setTimeout(() => b.remove(), 4000);
    });
}

// ─── MAIN GAME LOOP ───────────────────────────────────────────────────────────
function gameLoop() {
    if (!isRunning) return;

    spawnTimer++;
    buildingTimer++;

    // Spawn buildings
    if (buildingTimer % 120 === 0) spawnBuilding();

    // Spawn interactables
    const effectiveSpeed = questionMode ? gameSpeed * 0.3 : gameSpeed;

    if (!questionMode) {
        if (spawnTimer > 140) {
            spawnTimer = 0;
            if (Math.random() < 0.3) {
                spawnQuestionGates();
            } else {
                spawnObstacle();
            }
        }
    }

    // Update entities
    for (let i = activeEntities.length - 1; i >= 0; i--) {
        const ent = activeEntities[i];
        ent.progress += effectiveSpeed * 0.0012;
        positionEntity(ent);

        // Remove off-screen
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

        // Collision zone: entity reached the player
        if (ent.progress >= 0.95 && ent.progress <= 1.03 && ent.lane === currentLane) {
            const hit = ent;
            // Remove all same-group entities
            if (hit.type === 'gate') {
                questionMode = false;
                questionDisplay.classList.add('hidden');
                spawnTimer = 0;
                activeEntities.filter(e => e.type === 'gate').forEach(e => e.el.remove());
                activeEntities = activeEntities.filter(e => e.type !== 'gate');

                if (hit.correct) collectPart();
                else takeDamage();
            } else if (hit.type === 'obstacle') {
                if (!isJumping) {
                    hit.el.remove();
                    activeEntities.splice(activeEntities.indexOf(hit), 1);
                    takeDamage();
                }
            }
            // Re-index since we spliced
            break;
        }
    }

    // Increase difficulty over time
    gameSpeed += 0.0008;

    rafId = requestAnimationFrame(gameLoop);
}
