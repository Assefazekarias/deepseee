// ========== CONFIG ==========
const defaultConfig = {
    game_title: "DEEP SEA FISHING",
    game_subtitle: "Catch the biggest fish and top the leaderboard!",
    start_button_text: "PLAY",
    leaderboard_title: "🏆 LEADERBOARD"
};

// ========== LEVELS CONFIG ==========
const LEVELS = [];
const zoneNames = ["SHALLOWS", "CORAL REEF", "THE DROP", "ABYSS", "TRENCH", "MARIANA", "HADAL ZONE", "VOID"];

for (let i = 1; i <= 200; i++) {
    const zoneName = zoneNames[Math.floor((i - 1) / 25)] || "ABSOLUTE ZERO";
    LEVELS.push({
        id: i,
        name: `ZONE ${i}: ${zoneName}`,
        goal: 100 + (i * 50),
        time: Math.max(20, 60 - Math.floor(i / 5)), // Caps at 20 seconds
        speed: 1.0 + (i * 0.03),
        sharkChance: Math.min(0.4, i * 0.005),
        spawnBase: Math.max(250, 1200 - (i * 8))
    });
}
// Add Endless Mode at ID 201
LEVELS.push({ id: 201, name: "ENDLESS MODE", goal: '∞', time: '∞', speed: 1.0, sharkChance: 0.1, spawnBase: 1000 });

// ========== GAME STATE ==========
let state = {
    running: false,
    paused: false,
    score: 0,
    currentLevelId: 1,
    internalLevel: 1,
    maxUnlockedLevel: 1,
    fishCaught: 0,
    timeLeft: 60,
    playerName: 'ANGLER',
    fishes: [],
    lastSpawn: 0,
    lastTick: 0,
    allScores: [],
    combo: 0,
    lastCatchTime: 0
};

const FISH_TYPES = [
    { emoji: '🐟', points: 10, size: 40, speed: 1, weight: 40 },
    { emoji: '🐠', points: 10, size: 40, speed: 1.2, weight: 30 },
    { emoji: '🐡', points: 25, size: 45, speed: 1.5, weight: 20 },
    { emoji: '🦑', points: 50, size: 50, speed: 2, weight: 8 },
    { emoji: '🐙', points: 100, size: 55, speed: 2.5, weight: 2 }
];
const SHARK = { emoji: '🦈', points: -50, size: 70, speed: 3 };

// Add default mock scores
const mockScores = [
    { player_name: "AQUA_KING", score: 15000, level: '∞', fish_caught: 450 },
    { player_name: "CAPTAIN_J", score: 8200, level: 14, fish_caught: 220 },
    { player_name: "DEEP_DIVER", score: 4500, level: 8, fish_caught: 115 },
    { player_name: "FISH_GURU", score: 2800, level: 5, fish_caught: 80 },
    { player_name: "NOOB_SAILOR", score: 1000, level: 2, fish_caught: 30 }
];

// Load saved name and scores on init
document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('deepSeaPlayerName');
    if (savedName) {
        document.getElementById('player-name-input').value = savedName;
    }
    
    let localScores = JSON.parse(localStorage.getItem('deepSeaScores'));
    if (!localScores) {
        localScores = mockScores;
        localStorage.setItem('deepSeaScores', JSON.stringify(localScores));
    }
    state.allScores = localScores;
});

// ========== BUBBLES & SEAWEED ==========
function createBubbles() {
    const container = document.getElementById('bubbles');
    for (let i = 0; i < 20; i++) {
        const b = document.createElement('div');
        b.className = 'bubble';
        const size = 8 + Math.random() * 25;
        b.style.width = size + 'px';
        b.style.height = size + 'px';
        b.style.left = Math.random() * 100 + '%';
        b.style.bottom = '-50px';
        b.style.animationDuration = (6 + Math.random() * 8) + 's';
        b.style.animationDelay = (Math.random() * 10) + 's';
        container.appendChild(b);
    }
}

function createSeaweed() {
    const container = document.getElementById('seaweed-container');
    for (let i = 0; i < 12; i++) {
        const s = document.createElement('div');
        s.className = 'seaweed';
        s.style.left = (i * 8 + Math.random() * 5) + '%';
        s.style.height = (60 + Math.random() * 80) + 'px';
        s.style.animationDelay = (Math.random() * 3) + 's';
        s.style.animationDuration = (3 + Math.random() * 3) + 's';
        container.appendChild(s);
    }
}

// ========== SCREENS ==========
function showScreen(id) {
    ['start-screen', 'level-select-screen', 'game-screen', 'pause-screen', 'gameover-screen', 'leaderboard-screen'].forEach(s => {
        const el = document.getElementById(s);
        if(el) {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }
    });
    const target = document.getElementById(id);
    if(target) {
        target.classList.remove('hidden');
        if (id !== 'game-screen' && id !== 'start-screen') target.classList.add('flex');
    }
}

function openLevelSelect() {
    const nameInput = document.getElementById('player-name-input').value.trim();
    const name = nameInput.toUpperCase() || 'ANGLER';
    state.playerName = name;
    localStorage.setItem('deepSeaPlayerName', name);
    
    // Load unlocked level for this player
    const unlocked = localStorage.getItem(`deepSeaUnlockedLevel_${name}`);
    state.maxUnlockedLevel = unlocked ? parseInt(unlocked) : 1;
    
    renderLevelSelect();
    showScreen('level-select-screen');
}

function renderLevelSelect() {
    const container = document.getElementById('level-buttons-container');
    container.innerHTML = '';
    
    LEVELS.forEach(lvl => {
        const isEndless = lvl.id === 201;
        const isUnlocked = lvl.id <= state.maxUnlockedLevel || isEndless;
        
        const btn = document.createElement('button');
        btn.className = `level-btn pixel-font w-full ${isUnlocked ? 'unlocked' : ''} ${isEndless ? 'col-span-full sm:col-span-2 md:col-span-3 border-pink-500' : ''}`;
        if (isEndless) {
            btn.style.order = '-1'; // Force endless to top of grid
            btn.style.background = 'linear-gradient(135deg, rgba(60, 0, 60, 0.9), rgba(100, 0, 80, 0.9))';
            btn.style.boxShadow = '0 0 15px rgba(255, 0, 255, 0.4)';
        }
        btn.disabled = !isUnlocked;
        
        let goalText = isEndless ? `SURVIVAL: DON'T TOUCH SHARKS!` : `GOAL: ${lvl.goal} PTS`;
        
        btn.innerHTML = `
            ${!isUnlocked ? '<i data-lucide="lock" class="w-6 h-6 lock-icon text-slate-500 mb-2"></i>' : ''}
            <div class="text-sm mb-1">${isEndless ? '🏆' : 'LEVEL'} ${isEndless ? '' : lvl.id}</div>
            <div class="text-[10px] opacity-80">${lvl.name}</div>
            ${isUnlocked ? `<div class="text-[9px] ${isEndless ? 'text-pink-300' : 'text-yellow-300'} mt-2">${goalText}</div>` : ''}
        `;
        
        if (isUnlocked) {
            btn.addEventListener('click', () => startGame(lvl.id));
        }
        
        container.appendChild(btn);
    });
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ========== FISH SPAWNING & GAMEPLAY ==========
function pickFishType() {
    const total = FISH_TYPES.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * total;
    for (const f of FISH_TYPES) { if ((r -= f.weight) <= 0) return f; }
    return FISH_TYPES[0];
}

function spawnFish(speedMul, isShark = false) {
    const area = document.getElementById('game-area');
    const rect = area.getBoundingClientRect();
    const type = isShark ? SHARK : pickFishType();
    const fromLeft = Math.random() < 0.5;
    const y = 80 + Math.random() * (rect.height - 200);
    const el = document.createElement('div');
    el.className = 'fish';
    if (isShark) el.classList.add('shark-warning');
    el.style.fontSize = type.size + 'px';
    el.style.top = y + 'px';
    el.style.left = fromLeft ? '-80px' : (rect.width + 'px');
    el.textContent = type.emoji;
    el.style.transform = fromLeft ? 'scaleX(1)' : 'scaleX(-1)';
    
    const fish = {
        el, type, isShark,
        x: fromLeft ? -80 : rect.width,
        y,
        vx: (fromLeft ? 1 : -1) * type.speed * speedMul * (0.8 + Math.random() * 0.4),
        caught: false
    };
    el.addEventListener('click', (e) => { e.stopPropagation(); catchFish(fish); });
    el.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); catchFish(fish); }, { passive: false });
    area.appendChild(el);
    state.fishes.push(fish);
}

function catchFish(fish) {
    if (fish.caught) return;
    fish.caught = true;
    fish.el.classList.add('caught');
    
    const isEndless = state.currentLevelId === 201;
    
    if (isEndless && fish.isShark) {
        // SUDDEN DEATH IN ENDLESS!
        endGame(false);
        return;
    }
    
    let points = fish.type.points;
    const now = performance.now();
    
    if (!fish.isShark) {
        state.fishCaught++;
        // Combo system
        if (now - state.lastCatchTime < 2500) { // 2.5 seconds combo window
            state.combo++;
        } else {
            state.combo = 1;
        }
        state.lastCatchTime = now;
        
        points = points * state.combo;
        state.score = Math.max(0, state.score + points);
        
        if (state.combo > 1) {
            showCombo(state.combo, fish.x, fish.y - 40);
        }
    } else {
        // Normal mode shark catch
        state.combo = 0;
        state.score = Math.max(0, state.score + points);
    }

    // Score popup
    const pop = document.createElement('div');
    pop.className = 'score-popup';
    pop.textContent = (points >= 0 ? '+' : '') + points;
    pop.style.left = fish.x + 'px';
    pop.style.top = fish.y + 'px';
    pop.style.color = points > 50 ? '#ffd700' : points > 0 ? '#00ff88' : '#ff3366';
    pop.style.fontSize = points >= 50 ? '24px' : '18px';
    document.getElementById('game-area').appendChild(pop);
    setTimeout(() => pop.remove(), 1000);

    setTimeout(() => fish.el.remove(), 400);
    updateHUD();
}

function showCombo(combo, x, y) {
    const pop = document.createElement('div');
    pop.className = 'combo-popup';
    pop.textContent = `x${combo} COMBO!`;
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    // Frenzy colors for big combos
    if (combo >= 5) {
        pop.style.color = '#ff00ff';
        pop.style.textShadow = '0 0 10px #ff00ff';
        pop.style.transform = 'scale(1.5)';
    }
    document.getElementById('game-area').appendChild(pop);
    setTimeout(() => pop.remove(), 1000);
}

function updateHUD() {
    document.getElementById('score-display').textContent = state.score;
    
    const isEndless = state.currentLevelId === 201;
    const config = LEVELS[state.currentLevelId - 1];
    
    if (isEndless) {
        document.getElementById('level-display').textContent = `SURVIVAL L${state.internalLevel}`;
        document.getElementById('goal-display').textContent = '∞';
        document.getElementById('score-display').style.color = '#ff00ff';
        document.getElementById('time-display').textContent = '∞';
    } else {
        document.getElementById('level-display').textContent = state.currentLevelId;
        document.getElementById('goal-display').textContent = config.goal;
        const goalEl = document.getElementById('score-display');
        if (state.score >= config.goal) {
            goalEl.style.color = '#00ff88'; // green when reached
        } else {
            goalEl.style.color = '#ffd700'; // yellow otherwise
        }
        document.getElementById('time-display').textContent = Math.ceil(state.timeLeft);
    }
}

// ========== GAME LOOP ==========
let rafId = null;
function gameLoop(ts) {
    if (!state.running) return;
    if (state.paused) { rafId = requestAnimationFrame(gameLoop); state.lastTick = ts; return; }
    const dt = state.lastTick ? (ts - state.lastTick) / 1000 : 0;
    state.lastTick = ts;

    const isEndless = state.currentLevelId === 201;
    const levelConfig = LEVELS[state.currentLevelId - 1];

    // Reset combo if took too long
    if (state.combo > 0 && performance.now() - state.lastCatchTime > 3000) {
        state.combo = 0;
    }
    
    let spawnRate, sharkChance, speedMul;

    if (isEndless) {
        // Endless logic: Difficulty scales infinitely with score.
        // No timer decrement.
        const prevLevel = state.internalLevel;
        state.internalLevel = Math.floor(state.score / 500) + 1;
        
        if (state.internalLevel > prevLevel) {
            // Just a visual toast for getting further
            const toast = document.createElement('div');
            toast.className = 'combo-popup';
            toast.textContent = `DIFFICULTY UP!`;
            toast.style.left = '50%';
            toast.style.top = '20%';
            toast.style.color = '#ff003c';
            toast.style.fontSize = '32px';
            document.getElementById('game-area').appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
        }
        
        speedMul = 1.0 + (state.internalLevel * 0.1);
        sharkChance = Math.min(0.8, 0.1 + (state.internalLevel * 0.05));
        spawnRate = Math.max(150, 1000 - state.internalLevel * 80);
        
    } else {
        // Normal levels
        state.timeLeft -= dt;
        
        if (state.score >= levelConfig.goal) {
            endGame(true);
            return;
        }
        
        if (state.timeLeft <= 0) { 
            endGame(false); 
            return; 
        }
        
        speedMul = levelConfig.speed;
        sharkChance = levelConfig.sharkChance;
        spawnRate = Math.max(200, levelConfig.spawnBase);
    }

    // Spawn
    if (ts - state.lastSpawn > spawnRate) {
        state.lastSpawn = ts;
        const isShark = Math.random() < sharkChance;
        spawnFish(speedMul, isShark);
    }

    // Move fish
    const area = document.getElementById('game-area');
    const w = area.clientWidth;
    state.fishes = state.fishes.filter(f => {
        if (f.caught) return false;
        f.x += f.vx;
        f.el.style.left = f.x + 'px';
        if (f.x < -150 || f.x > w + 150) { f.el.remove(); return false; }
        return true;
    });

    updateHUD();
    rafId = requestAnimationFrame(gameLoop);
}

// ========== START / END ==========
function startGame(levelId) {
    const config = LEVELS[levelId - 1];
    
    state = {
        running: true, paused: false,
        score: 0, currentLevelId: levelId, internalLevel: 1, maxUnlockedLevel: state.maxUnlockedLevel,
        fishCaught: 0, timeLeft: config.time === '∞' ? 999 : config.time,
        playerName: state.playerName,
        fishes: [], lastSpawn: 0, lastTick: 0,
        allScores: state.allScores,
        combo: 0, lastCatchTime: performance.now()
    };
    
    document.getElementById('game-area').innerHTML = '';
    
    // Reset score color
    document.getElementById('score-display').style.color = levelId === 201 ? '#ff00ff' : '#ffd700';
    
    updateHUD();
    showScreen('game-screen');
    rafId = requestAnimationFrame(gameLoop);
}

function pauseGame() {
    if (!state.running) return;
    state.paused = true;
    showScreen('pause-screen');
}

function resumeGame() {
    state.paused = false;
    state.lastTick = 0;
    showScreen('game-screen');
}

async function endGame(isWin) {
    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    
    document.getElementById('final-score').textContent = state.score;
    document.getElementById('save-status').textContent = 'Saving score...';
    
    const titleEl = document.getElementById('gameover-title');
    const msgEl = document.getElementById('gameover-msg');
    const nextBtn = document.getElementById('next-level-btn');
    
    const isEndless = state.currentLevelId === 201;
    
    if (isEndless) {
        titleEl.textContent = "GAME OVER!";
        titleEl.style.color = "#ff3366"; // red
        msgEl.textContent = `You caught a shark! Final survival level: ${state.internalLevel}`;
        nextBtn.classList.add('hidden');
    } else if (isWin) {
        titleEl.textContent = "LEVEL CLEAR!";
        titleEl.style.color = "#00ff88"; // green
        msgEl.textContent = "Target score reached! Great job!";
        
        // Unlock next level
        if (state.currentLevelId < 200) { 
            state.maxUnlockedLevel = Math.max(state.maxUnlockedLevel, state.currentLevelId + 1);
            localStorage.setItem(`deepSeaUnlockedLevel_${state.playerName}`, state.maxUnlockedLevel);
            nextBtn.classList.remove('hidden');
        } else {
            msgEl.textContent = "You beat LEVEL 200! You are a master angler!";
            nextBtn.classList.add('hidden');
        }
    } else {
        titleEl.textContent = "TIME'S UP!";
        titleEl.style.color = "#ff3366"; // red
        msgEl.textContent = "You didn't reach the target score. Try again!";
        nextBtn.classList.add('hidden');
    }
    
    showScreen('gameover-screen');

    // Save score locally
    const newScore = {
        player_name: state.playerName,
        score: state.score,
        level: isEndless ? '∞' : state.currentLevelId,
        fish_caught: state.fishCaught,
        created_at: new Date().toISOString()
    };
    
    let localScores = JSON.parse(localStorage.getItem('deepSeaScores')) || [];
    localScores.push(newScore);
    // Sort and keep top 50
    localScores.sort((a, b) => b.score - a.score);
    localScores = localScores.slice(0, 50);
    localStorage.setItem('deepSeaScores', JSON.stringify(localScores));
    state.allScores = localScores;

    if (window.dataSdk) {
        if (state.allScores.length >= 999) {
            document.getElementById('save-status').textContent = '⚠️ Leaderboard full (999 max)';
        } else {
            const result = await window.dataSdk.create(newScore);
            document.getElementById('save-status').textContent = result.isOk ? '✓ Score saved!' : '⚠️ Could not save remote score';
        }
    } else {
        document.getElementById('save-status').textContent = '✓ Score saved locally!';
    }
}

function quitToLevelSelect() {
    state.running = false;
    state.paused = false;
    if (rafId) cancelAnimationFrame(rafId);
    document.getElementById('game-area').innerHTML = ''; // This causes no layout shift now that body is overflow-hidden
    renderLevelSelect();
    showScreen('level-select-screen');
}

// ========== LEADERBOARD ==========
function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    const sorted = [...state.allScores].sort((a, b) => b.score - a.score).slice(0, 50);
    if (sorted.length === 0) {
        list.innerHTML = '<div class="text-center text-cyan-300 py-8 pixel-font text-xs">No scores yet.<br>Be the first!</div>';
        return;
    }
    list.innerHTML = sorted.map((s, i) => `
    <div class="leaderboard-row hud-panel rounded-lg p-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-3 min-w-0">
        <div class="pixel-font text-sm w-8 flex-shrink-0">#${i + 1}</div>
        <div class="min-w-0">
          <div class="pixel-font text-xs truncate">${escapeHtml(s.player_name)}</div>
          <div class="text-[10px] opacity-70">Lvl ${s.level} · 🐟${s.fish_caught}</div>
        </div>
      </div>
      <div class="pixel-font text-lg flex-shrink-0">${s.score}</div>
    </div>
  `).join('');
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ========== SDK INIT ==========
async function initSDKs() {
    if (window.dataSdk) {
        await window.dataSdk.init({
            onDataChanged(data) {
                state.allScores = data || [];
                if (!document.getElementById('leaderboard-screen').classList.contains('hidden')) {
                    renderLeaderboard();
                }
            }
        });
    }

    if (window.elementSdk) {
        window.elementSdk.init({
            defaultConfig,
            onConfigChange: async (config) => {
                document.getElementById('title-text').textContent = config.game_title || defaultConfig.game_title;
                document.getElementById('subtitle-text').textContent = config.game_subtitle || defaultConfig.game_subtitle;
                document.getElementById('start-btn-text').textContent = config.start_button_text || defaultConfig.start_button_text;
                document.getElementById('leaderboard-title-text').textContent = config.leaderboard_title || defaultConfig.leaderboard_title;
            },
            mapToCapabilities: (config) => ({
                recolorables: [],
                borderables: [],
                fontEditable: undefined,
                fontSizeable: undefined
            }),
            mapToEditPanelValues: (config) => new Map([
                ['game_title', config.game_title || defaultConfig.game_title],
                ['game_subtitle', config.game_subtitle || defaultConfig.game_subtitle],
                ['start_button_text', config.start_button_text || defaultConfig.start_button_text],
                ['leaderboard_title', config.leaderboard_title || defaultConfig.leaderboard_title]
            ])
        });
    }
}

// ========== EVENTS ==========
document.getElementById('start-btn').addEventListener('click', openLevelSelect);
document.getElementById('back-to-start-btn').addEventListener('click', () => showScreen('start-screen'));
document.getElementById('show-leaderboard-btn').addEventListener('click', () => { renderLeaderboard(); showScreen('leaderboard-screen'); });
document.getElementById('close-leaderboard-btn').addEventListener('click', () => showScreen('start-screen'));
document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('pause-quit-btn').addEventListener('click', quitToLevelSelect);
document.getElementById('retry-btn').addEventListener('click', () => startGame(state.currentLevelId));
document.getElementById('next-level-btn').addEventListener('click', () => startGame(state.currentLevelId + 1));
document.getElementById('levels-btn').addEventListener('click', quitToLevelSelect);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (state.running && !state.paused) pauseGame();
        else if (state.paused) resumeGame();
    }
});

// ========== BOOT ==========
createBubbles();
createSeaweed();
if (window.lucide) {
    lucide.createIcons();
}
initSDKs();
