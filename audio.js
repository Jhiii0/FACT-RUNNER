// ─── FACT RUNNER: AUDIO ENGINE (WEB AUDIO API) ────────────────────────────────
// Procedural sound synthesizer & dual-mode BGM engine (Home Screen & Runner).
// Zero external file dependencies for 100% offline reliability & instant playback.

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.bgmGain = null;
        this.isMuted = localStorage.getItem('factRunnerSoundMuted') === 'true';
        this.volume = parseFloat(localStorage.getItem('factRunnerSoundVolume') || '0.7');
        
        // BGM Sequencer state
        this.bgmTimer = null;
        this.currentBgmType = null; // 'menu' | 'runner' | null
        this.bgmStep = 0;
        
        this.initAudioContext();
    }

    initAudioContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
                
                // Master Gain
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
                this.masterGain.connect(this.ctx.destination);

                // SFX Gain
                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
                this.sfxGain.connect(this.masterGain);

                // BGM Gain
                this.bgmGain = this.ctx.createGain();
                this.bgmGain.gain.setValueAtTime(0.32, this.ctx.currentTime);
                this.bgmGain.connect(this.masterGain);
            }
        }
    }

    ensureContext() {
        if (!this.ctx) {
            this.initAudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        localStorage.setItem('factRunnerSoundVolume', this.volume.toString());
        if (this.masterGain && this.ctx) {
            const targetGain = this.isMuted ? 0 : this.volume;
            this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.03);
        }
        this.syncUI();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('factRunnerSoundMuted', this.isMuted.toString());
        if (this.masterGain && this.ctx) {
            const targetGain = this.isMuted ? 0 : this.volume;
            this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.03);
        }
        this.syncUI();
        return this.isMuted;
    }

    syncUI() {
        const volPercent = Math.round(this.volume * 100);
        
        // Volume sliders
        const sliders = document.querySelectorAll('.sound-volume-slider');
        sliders.forEach(slider => {
            slider.value = volPercent;
        });

        // Volume labels
        const labels = document.querySelectorAll('.sound-volume-val');
        labels.forEach(lbl => {
            lbl.textContent = `${volPercent}%`;
        });

        // Mute buttons
        const muteBtns = document.querySelectorAll('.sound-mute-toggle-btn');
        muteBtns.forEach(btn => {
            if (this.isMuted) {
                btn.classList.add('muted');
                btn.innerHTML = '🔇 <span class="mute-btn-text">UNMUTE</span>';
            } else {
                btn.classList.remove('muted');
                btn.innerHTML = '🔊 <span class="mute-btn-text">MUTE</span>';
            }
        });

        // HUD Sound Button
        const hudSoundBtn = document.getElementById('hud-sound-btn');
        if (hudSoundBtn) {
            hudSoundBtn.textContent = this.isMuted ? '🔇' : (this.volume < 0.4 ? '🔉' : '🔊');
            hudSoundBtn.title = this.isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)';
            hudSoundBtn.classList.toggle('muted', this.isMuted);
        }
    }

    // ── PROCEDURAL SOUND EFFECTS ──────────────────────────────────────────────

    // Button Click / UI Tap
    playClick() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(350, this.ctx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.045);
    }

    // Subtle Button Hover Tick
    playHover() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.025);
    }

    // Volume Slider Test Sound
    playSliderTest() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.11);
    }

    // Zone Selector Distinct Chimes
    playZoneSelect(zone) {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;

        if (zone === 'mathematics') {
            // High crisp Math crystal tone
            [523.25, 783.99, 1046.50].forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, now + i * 0.05);
                gain.gain.setValueAtTime(0.25, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.15);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.16);
            });
        } else if (zone === 'science') {
            // Science bubbling laser chirp
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(now);
            osc.stop(now + 0.16);
        } else if (zone === 'history') {
            // History warm tubular harp chime
            [392.00, 523.25, 659.25].forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, now + i * 0.06);
                gain.gain.setValueAtTime(0.3, now + i * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now + i * 0.06);
                osc.stop(now + i * 0.06 + 0.23);
            });
        } else if (zone === 'technology') {
            // Tech 8-bit computer blip
            [440, 880, 1760].forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(f, now + i * 0.04);
                gain.gain.setValueAtTime(0.18, now + i * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.08);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now + i * 0.04);
                osc.stop(now + i * 0.04 + 0.09);
            });
        } else {
            // All Subjects rainbow arpeggio
            [440, 554.37, 659.25, 880, 1108.73].forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, now + i * 0.04);
                gain.gain.setValueAtTime(0.24, now + i * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now + i * 0.04);
                osc.stop(now + i * 0.04 + 0.2);
            });
        }
    }

    // Start Challenge Launch Jingle
    playStartGame() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const notes = [
            { f: 523.25, d: 0.09 }, // C5
            { f: 659.25, d: 0.09 }, // E5
            { f: 783.99, d: 0.12 }, // G5
            { f: 1046.50, d: 0.35 } // C6
        ];

        let offset = 0;
        notes.forEach((n) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const t = now + offset;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.f, t);

            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(t);
            osc.stop(t + n.d + 0.02);

            offset += 0.08;
        });
    }

    // Jump Whoop
    playJump() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(620, this.ctx.currentTime + 0.18);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.23);
    }

    // Correct Answer / Loot Collect Chime
    playCorrect() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = this.ctx.currentTime + i * 0.06;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.35, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(startTime);
            osc.stop(startTime + 0.26);
        });
    }

    // Streak / High Combo Bonus Sparkle
    playStreakBonus() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const notes = [659.25, 783.99, 987.77, 1318.51, 1567.98];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = this.ctx.currentTime + i * 0.045;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.28, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(startTime);
            osc.stop(startTime + 0.22);
        });
    }

    // Damage / Wrong Answer / Collision Buzzer
    playDamage() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.28);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.32);
    }

    // Obstacle Dodged Whoosh
    playDodge() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(580, this.ctx.currentTime + 0.08);
        osc.frequency.exponentialRampToValueAtTime(260, this.ctx.currentTime + 0.16);

        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.19);
    }

    // Evolution Fanfare
    playEvolution() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const chords = [
            { freqs: [261.63, 329.63, 392.00], duration: 0.16 }, // C4, E4, G4
            { freqs: [329.63, 392.00, 493.88], duration: 0.16 }, // E4, G4, B4
            { freqs: [392.00, 493.88, 587.33], duration: 0.20 }, // G4, B4, D5
            { freqs: [523.25, 659.25, 783.99, 1046.50], duration: 0.65 } // C5, E5, G5, C6
        ];

        let offset = 0;
        chords.forEach((chord) => {
            chord.freqs.forEach(freq => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const startTime = this.ctx.currentTime + offset;

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0.32, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + chord.duration);

                osc.connect(gain);
                gain.connect(this.sfxGain);

                osc.start(startTime);
                osc.stop(startTime + chord.duration + 0.02);
            });
            offset += chord.duration * 0.85;
        });
    }

    // Game Over Theme
    playGameOver() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const notes = [
            { freq: 440.00, time: 0.00, dur: 0.25 }, // A4
            { freq: 392.00, time: 0.24, dur: 0.25 }, // G4
            { freq: 349.23, time: 0.48, dur: 0.28 }, // F4
            { freq: 293.66, time: 0.74, dur: 0.60 }  // D4
        ];

        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = this.ctx.currentTime + n.time;

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(n.freq, startTime);

            gain.gain.setValueAtTime(0.28, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.dur);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(startTime);
            osc.stop(startTime + n.dur + 0.02);
        });
    }

    // ── BGM SEQUENCERS: HOME SCREEN & RUNNER ───────────────────────────────────

    // 1. HOME SCREEN BGM (Chill, cheerful, warm school theme)
    startMenuBGM() {
        this.ensureContext();
        if (this.currentBgmType === 'menu') return;
        this.stopBGM();
        this.currentBgmType = 'menu';
        this.bgmStep = 0;
        this.playMenuBGMStep();
    }

    playMenuBGMStep() {
        if (this.currentBgmType !== 'menu' || !this.ctx) return;

        const tempo = 104; // Relaxed menu tempo (BPM)
        const stepTime = (60 / tempo) / 2; // 8th notes

        // Cheerful study hall melody
        const melody = [
            392.00, 0, 440.00, 523.25, 0, 659.25, 523.25, 0,
            440.00, 0, 392.00, 329.63, 349.23, 0, 392.00, 0,
            523.25, 0, 587.33, 659.25, 0, 783.99, 659.25, 0,
            587.33, 523.25, 440.00, 392.00, 523.25, 0, 0, 0
        ];

        // Soft chord bassline
        const bass = [
            261.63, 261.63, 261.63, 261.63, 329.63, 329.63, 329.63, 329.63,
            220.00, 220.00, 220.00, 220.00, 174.61, 174.61, 196.00, 196.00,
            261.63, 261.63, 261.63, 261.63, 329.63, 329.63, 329.63, 329.63,
            174.61, 174.61, 196.00, 196.00, 261.63, 261.63, 261.63, 261.63
        ];

        const currentMelodyFreq = melody[this.bgmStep % melody.length];
        const currentBassFreq = bass[this.bgmStep % bass.length];

        const now = this.ctx.currentTime;

        // Gentle Melody (Sine + slight warmth)
        if (currentMelodyFreq > 0 && !this.isMuted) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(currentMelodyFreq, now);

            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.9);

            osc.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(now);
            osc.stop(now + stepTime * 0.95);
        }

        // Warm Bass (Triangle)
        if (currentBassFreq > 0 && (this.bgmStep % 2 === 0) && !this.isMuted) {
            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();

            bassOsc.type = 'triangle';
            bassOsc.frequency.setValueAtTime(currentBassFreq, now);

            bassGain.gain.setValueAtTime(0.14, now);
            bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 1.8);

            bassOsc.connect(bassGain);
            bassGain.connect(this.bgmGain);

            bassOsc.start(now);
            bassOsc.stop(now + stepTime * 1.85);
        }

        this.bgmStep = (this.bgmStep + 1) % melody.length;
        this.bgmTimer = setTimeout(() => {
            this.playMenuBGMStep();
        }, stepTime * 1000);
    }

    // 2. IN-GAME RUNNER BGM (Upbeat, 8-bit chiptune groove)
    startRunnerBGM() {
        this.ensureContext();
        if (this.currentBgmType === 'runner') return;
        this.stopBGM();
        this.currentBgmType = 'runner';
        this.bgmStep = 0;
        this.playRunnerBGMStep();
    }

    playRunnerBGMStep() {
        if (this.currentBgmType !== 'runner' || !this.ctx) return;

        const tempo = 132; // Fast runner tempo
        const stepTime = (60 / tempo) / 2;

        const melody = [
            523.25, 0, 587.33, 659.25, 0, 783.99, 659.25, 0,
            880.00, 783.99, 659.25, 587.33, 523.25, 0, 587.33, 0
        ];

        const bass = [
            130.81, 130.81, 146.83, 146.83, 164.81, 164.81, 196.00, 196.00,
            220.00, 220.00, 196.00, 196.00, 174.61, 174.61, 196.00, 196.00
        ];

        const currentMelodyFreq = melody[this.bgmStep % melody.length];
        const currentBassFreq = bass[this.bgmStep % bass.length];

        const now = this.ctx.currentTime;

        if (currentMelodyFreq > 0 && !this.isMuted) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(currentMelodyFreq, now);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.85);

            osc.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(now);
            osc.stop(now + stepTime * 0.9);
        }

        if (currentBassFreq > 0 && !this.isMuted) {
            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();

            bassOsc.type = 'triangle';
            bassOsc.frequency.setValueAtTime(currentBassFreq, now);

            bassGain.gain.setValueAtTime(0.16, now);
            bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.9);

            bassOsc.connect(bassGain);
            bassGain.connect(this.bgmGain);

            bassOsc.start(now);
            bassOsc.stop(now + stepTime * 0.95);
        }

        this.bgmStep = (this.bgmStep + 1) % 32;
        this.bgmTimer = setTimeout(() => {
            this.playRunnerBGMStep();
        }, stepTime * 1000);
    }

    pauseBGM() {
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
    }

    resumeBGM() {
        if (this.currentBgmType === 'menu') {
            this.playMenuBGMStep();
        } else if (this.currentBgmType === 'runner') {
            this.playRunnerBGMStep();
        }
    }

    stopBGM() {
        this.pauseBGM();
        this.currentBgmType = null;
        this.bgmStep = 0;
    }
}

// Global Audio Engine Instance
const soundEngine = new SoundEngine();

// Auto-start Menu BGM & unlock AudioContext on first user interaction
function handleFirstInteraction() {
    soundEngine.ensureContext();
    if (!soundEngine.currentBgmType && !document.getElementById('main-menu').classList.contains('hidden')) {
        soundEngine.startMenuBGM();
    }
    document.removeEventListener('pointerdown', handleFirstInteraction);
    document.removeEventListener('keydown', handleFirstInteraction);
}

document.addEventListener('pointerdown', handleFirstInteraction);
document.addEventListener('keydown', handleFirstInteraction);
