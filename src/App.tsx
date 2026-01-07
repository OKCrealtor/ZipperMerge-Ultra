import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// ==================== TYPES ====================
type Direction = 'up' | 'down' | 'left' | 'right';
type Theme = 'dark' | 'light' | 'neon';

interface Tile {
  id: string;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  justMerged?: boolean;
}

interface GameState {
  tiles: Tile[];
  score: number;
  moves: number;
  comboCount: number;
  gameOver: boolean;
  won: boolean;
}

interface GameEngine {
  state: GameState;
  history: GameState[];
  undosRemaining: number;
  highScore: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  type: 'regular' | 'firework' | 'spark' | 'trail' | 'star' | 'heart' | 'triangle' | 'ring';
  rotation?: number;
  rotationSpeed?: number;
  pulsePhase?: number;
}

interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  bestCombo: number;
  highestTile: number;
}

// ==================== HAPTIC FEEDBACK ====================
const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  // Check if iOS (haptics not supported via vibrate API)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (isIOS) {
    return; // iOS doesn't support navigator.vibrate
  }
  
  try {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30]
      };
      navigator.vibrate(patterns[style]);
    }
  } catch (e) {
    // Haptics not supported, silently fail
  }
};

// ==================== GAME ENGINE ====================
let nextId = 0;

const createEmptyState = (): GameState => ({
  tiles: [],
  score: 0,
  moves: 0,
  comboCount: 0,
  gameOver: false,
  won: false,
});

const loadHighScore = (): number => {
  const saved = localStorage.getItem('zipperMergeHighScore');
  return saved ? parseInt(saved, 10) : 0;
};

const saveHighScore = (score: number) => {
  localStorage.setItem('zipperMergeHighScore', score.toString());
};

const loadStats = (): Stats => {
  const saved = localStorage.getItem('zipperMergeStats');
  return saved
    ? JSON.parse(saved)
    : { gamesPlayed: 0, gamesWon: 0, totalScore: 0, bestCombo: 0, highestTile: 0 };
};

const saveStats = (stats: Stats) => {
  localStorage.setItem('zipperMergeStats', JSON.stringify(stats));
};

const initGame = (size = 4): GameEngine => {
  nextId = 0;
  const state = createEmptyState();
  spawnTile(state, size);
  spawnTile(state, size);
  return {
    state,
    history: [],
    undosRemaining: 3,
    highScore: loadHighScore(),
  };
};

const spawnTile = (state: GameState, size: number): void => {
  const emptyCells: { row: number; col: number }[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!state.tiles.some((t) => t.row === row && t.col === col)) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length === 0) return;

  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = Math.random() < 0.9 ? 2 : 4;

  state.tiles.push({
    id: `tile-${nextId++}`,
    value,
    row: cell.row,
    col: cell.col,
    isNew: true,
  });
};

const buildGrid = (tiles: Tile[], size: number): (Tile | null)[][] => {
  const grid: (Tile | null)[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));
  tiles.forEach((tile) => {
    grid[tile.row][tile.col] = tile;
  });
  return grid;
};

const getVector = (direction: Direction): { row: number; col: number } => {
  return {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 },
  }[direction];
};

const getTraversals = (direction: Direction, size: number) => {
  const rows = Array.from({ length: size }, (_, i) => i);
  const cols = Array.from({ length: size }, (_, i) => i);

  if (direction === 'down') rows.reverse();
  if (direction === 'right') cols.reverse();

  return { rows, cols };
};

const findFarthestPosition = (
  position: { row: number; col: number },
  vector: { row: number; col: number },
  grid: (Tile | null)[][],
  size: number
) => {
  let previous = position;

  while (true) {
    const next = {
      row: previous.row + vector.row,
      col: previous.col + vector.col,
    };

    if (next.row < 0 || next.row >= size || next.col < 0 || next.col >= size) {
      break;
    }

    if (grid[next.row][next.col] !== null) {
      return { farthest: previous, next: next };
    }

    previous = next;
  }

  return { farthest: previous, next: null };
};

const moveTile = (
  tile: Tile,
  position: { row: number; col: number },
  tiles: Tile[],
  grid: (Tile | null)[][]
) => {
  grid[tile.row][tile.col] = null;
  tile.row = position.row;
  tile.col = position.col;
  grid[position.row][position.col] = tile;
};

const move = (engine: GameEngine, direction: Direction, size = 4): boolean => {
  engine.state.tiles.forEach((t) => {
    t.justMerged = false;
    t.isNew = false;
  });

  const vector = getVector(direction);
  const traversals = getTraversals(direction, size);
  let moved = false;
  let grid = buildGrid(engine.state.tiles, size);
  const mergedPositions = new Set<string>();

  engine.state.comboCount = 0;

  for (const row of traversals.rows) {
    for (const col of traversals.cols) {
      const tile = grid[row][col];
      if (tile === null) continue;

      const positions = findFarthestPosition({ row, col }, vector, grid, size);
      const next = positions.next;

      if (next && grid[next.row][next.col]) {
        const nextTile = grid[next.row][next.col]!;
        const mergeKey = `${next.row},${next.col}`;

        if (nextTile.value === tile.value && !mergedPositions.has(mergeKey)) {
          const merged: Tile = {
            id: nextTile.id,
            value: tile.value * 2,
            row: next.row,
            col: next.col,
            justMerged: true,
          };

          engine.state.score += merged.value;
          engine.state.comboCount++;

          const idx = engine.state.tiles.indexOf(tile);
          if (idx !== -1) engine.state.tiles.splice(idx, 1);

          const nextIdx = engine.state.tiles.indexOf(nextTile);
          if (nextIdx !== -1) {
            engine.state.tiles[nextIdx] = merged;
          }

          grid[next.row][next.col] = merged;
          mergedPositions.add(mergeKey);
          moved = true;

          if (merged.value === 2048 && !engine.state.won) {
            engine.state.won = true;
          }
        } else {
          moveTile(tile, positions.farthest, engine.state.tiles, grid);
          if (positions.farthest.row !== row || positions.farthest.col !== col) {
            moved = true;
          }
        }
      } else {
        moveTile(tile, positions.farthest, engine.state.tiles, grid);
        if (positions.farthest.row !== row || positions.farthest.col !== col) {
          moved = true;
        }
      }
    }
  }

  if (moved) {
    engine.state.moves++;
    spawnTile(engine.state, size);

    if (engine.state.score > engine.highScore) {
      engine.highScore = engine.state.score;
      saveHighScore(engine.highScore);
    }

    const availableMoves = checkAvailableMoves(engine.state, size);
    if (!availableMoves) {
      engine.state.gameOver = true;
      const stats = loadStats();
      stats.gamesPlayed++;
      stats.totalScore += engine.state.score;
      stats.bestCombo = Math.max(stats.bestCombo, engine.state.comboCount);
      const highestTile = Math.max(...engine.state.tiles.map((t) => t.value));
      stats.highestTile = Math.max(stats.highestTile, highestTile);
      if (engine.state.won) stats.gamesWon++;
      saveStats(stats);
    }
  }

  return moved;
};

const checkAvailableMoves = (state: GameState, size: number): boolean => {
  const grid = buildGrid(state.tiles, size);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col] === null) return true;

      const tile = grid[row][col];
      if (!tile) continue;

      if (col < size - 1 && grid[row][col + 1]?.value === tile.value) return true;
      if (row < size - 1 && grid[row + 1][col]?.value === tile.value) return true;
    }
  }

  return false;
};

// ==================== AUDIO SYSTEM ====================
class AudioSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;

  init() {
    if (this.context) return;
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.context.destination);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled && !this.context) {
      this.init();
    }
  }

  playMove() {
    if (!this.enabled || !this.context || !this.masterGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(180, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.context.currentTime + 0.04);

    gain.gain.setValueAtTime(0.1, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.04);

    osc.start(this.context.currentTime);
    osc.stop(this.context.currentTime + 0.04);
  }

  playMerge(value: number, comboCount: number) {
    if (!this.enabled || !this.context || !this.masterGain) return;

    const now = this.context.currentTime;
    const baseFreq = 200 + Math.log2(value) * 50;
    const volume = Math.min(0.15 + comboCount * 0.02, 0.3);

    const noise = this.context.createBufferSource();
    const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 0.05, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const noiseFilter = this.context.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 1;

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.05, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.05);

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.1);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playCombo(comboCount: number) {
    if (!this.enabled || !this.context || !this.masterGain) return;

    const now = this.context.currentTime;
    const baseFreq = 300;
    const scale = [1, 1.25, 1.5];

    for (let i = 0; i < Math.min(comboCount, 3); i++) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.connect(gain);
      gain.connect(this.masterGain);

      const freq = baseFreq * scale[i];
      osc.frequency.setValueAtTime(freq, now + i * 0.1);

      gain.gain.setValueAtTime(0.1, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.15);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.15);
    }
  }

  playWin() {
    if (!this.enabled || !this.context || !this.masterGain) return;

    const now = this.context.currentTime;
    const notes = [262, 330, 392, 523, 659];

    notes.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.frequency.setValueAtTime(freq, now + i * 0.15);

      gain.gain.setValueAtTime(0.15, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);

      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    });
  }

  playGameOver() {
    if (!this.enabled || !this.context || !this.masterGain) return;

    const now = this.context.currentTime;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.5);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.5);
  }
}

const audioSystem = new AudioSystem();

// ==================== ENHANCED PARTICLE SYSTEM ====================

// Progressive fireworks based on tile value
const createEnhancedFireworks = (x: number, y: number, value: number, color: string): Particle[] => {
  const particles: Particle[] = [];
  
  // 32: Rainbow burst + trails
  if (value >= 32) {
    const rainbowColors = ['#ff0080', '#00ff80', '#0080ff', '#ff8000', '#8000ff', '#ffff00'];
    const burstCount = 12;
    
    for (let i = 0; i < burstCount; i++) {
      const angle = (Math.PI * 2 * i) / burstCount;
      const speed = 2.5 + Math.random() * 1.5;
      
      particles.push({
        id: `firework-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 1.6,
        color: rainbowColors[i % rainbowColors.length],
        size: 3.5 + Math.random() * 1.5,
        type: 'firework',
      });
    }
    
    // Add trailing particles
    const trailCount = 8;
    for (let i = 0; i < trailCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 1;
      
      particles.push({
        id: `trail-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.8,
        color: rainbowColors[Math.floor(Math.random() * rainbowColors.length)],
        size: 2.5 + Math.random() * 1,
        type: 'trail',
      });
    }
  }
  
  // 64: Add white sparks shooting upward
  if (value >= 64) {
    const sparkCount = 15;
    for (let i = 0; i < sparkCount; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      const speed = 4 + Math.random() * 3;
      
      particles.push({
        id: `spark-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.3,
        color: '#ffffff',
        size: 2.5 + Math.random() * 1,
        type: 'spark',
      });
    }
  }
  
  // 128: Add rotating stars
  if (value >= 128) {
    const starCount = 8;
    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount;
      const speed = 2 + Math.random() * 1.5;
      
      particles.push({
        id: `star-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        life: 2.0,
        color: '#ffff00',
        size: 4 + Math.random() * 2,
        type: 'star',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
      });
    }
  }
  
  // 256: Add pulsing hearts
  if (value >= 256) {
    const heartCount = 6;
    for (let i = 0; i < heartCount; i++) {
      const angle = (Math.PI * 2 * i) / heartCount;
      const speed = 1.5 + Math.random() * 1;
      
      particles.push({
        id: `heart-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 2.2,
        color: '#ff1493',
        size: 5 + Math.random() * 2,
        type: 'heart',
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }
  
  // 512: Add expanding rings
  if (value >= 512) {
    const ringCount = 5;
    for (let i = 0; i < ringCount; i++) {
      const angle = (Math.PI * 2 * i) / ringCount;
      const speed = 3 + Math.random() * 2;
      
      particles.push({
        id: `ring-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 2.5,
        color: '#00ffff',
        size: 6 + Math.random() * 2,
        type: 'ring',
        rotation: angle,
      });
    }
  }
  
  // 1024+: Add triangles spinning outward
  if (value >= 1024) {
    const triangleCount = 10;
    for (let i = 0; i < triangleCount; i++) {
      const angle = (Math.PI * 2 * i) / triangleCount;
      const speed = 2.5 + Math.random() * 2;
      
      particles.push({
        id: `triangle-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.2,
        life: 2.8,
        color: '#ff00ff',
        size: 5 + Math.random() * 2,
        type: 'triangle',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.4,
      });
    }
  }
  
  return particles;
};

const updateParticles = (particles: Particle[]): Particle[] => {
  return particles
    .map((p) => {
      let gravity = 0.5;
      let fadeRate = 0.05;
      let airResistance = 1.0;

      if (p.type === 'firework') {
        gravity = 0.35;
        fadeRate = 0.025;
        airResistance = 0.98;
      } else if (p.type === 'spark') {
        gravity = 0.25;
        fadeRate = 0.03;
        airResistance = 0.97;
      } else if (p.type === 'trail') {
        gravity = 0.15;
        fadeRate = 0.02;
        airResistance = 0.96;
      } else if (p.type === 'star') {
        gravity = 0.3;
        fadeRate = 0.022;
        airResistance = 0.97;
      } else if (p.type === 'heart') {
        gravity = 0.2;
        fadeRate = 0.02;
        airResistance = 0.96;
      } else if (p.type === 'ring') {
        gravity = 0.25;
        fadeRate = 0.018;
        airResistance = 0.95;
      } else if (p.type === 'triangle') {
        gravity = 0.28;
        fadeRate = 0.016;
        airResistance = 0.96;
      }

      const newParticle = {
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vx: p.vx * airResistance,
        vy: p.vy + gravity,
        life: p.life - fadeRate,
      };

      if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
        newParticle.rotation = (p.rotation + p.rotationSpeed) % (Math.PI * 2);
      }

      if (p.pulsePhase !== undefined) {
        newParticle.pulsePhase = p.pulsePhase + 0.15;
      }

      return newParticle;
    })
    .filter((p) => p.life > 0 && p.y < 120);
};

// ==================== THEME SYSTEM ====================
const themes: Record<Theme, any> = {
  dark: {
    background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
    boardBg: '#16213e',
    cellBg: '#0f1626',
    text: '#ffffff',
    textSecondary: '#a0a0c0',
    tiles: {
      2: '#2d3561',
      4: '#3d4785',
      8: '#4a5899',
      16: '#5e6bbd',
      32: '#7280e3',
      64: '#8a96ff',
      128: '#a0b0ff',
      256: '#b8c5ff',
      512: '#d0daff',
      1024: '#e8ecff',
      2048: '#ffffff',
      4096: '#fff0f0',
      8192: '#ffe0e0',
      16384: '#ffd0d0',
    },
  },
  light: {
    background: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)',
    boardBg: '#bbada0',
    cellBg: '#cdc1b4',
    text: '#776e65',
    textSecondary: '#8f8579',
    tiles: {
      2: '#eee4da',
      4: '#ede0c8',
      8: '#f2b179',
      16: '#f59563',
      32: '#f67c5f',
      64: '#f65e3b',
      128: '#edcf72',
      256: '#edcc61',
      512: '#edc850',
      1024: '#edc53f',
      2048: '#edc22e',
      4096: '#3c3a32',
      8192: '#3c3a32',
      16384: '#3c3a32',
    },
  },
  neon: {
    background: 'linear-gradient(135deg, #000000 0%, #1a0033 100%)',
    boardBg: '#1a0033',
    cellBg: '#2d0052',
    text: '#00ffff',
    textSecondary: '#ff00ff',
    tiles: {
      2: '#ff00ff',
      4: '#ff0080',
      8: '#ff0000',
      16: '#ff8000',
      32: '#ffff00',
      64: '#00ff00',
      128: '#00ff80',
      256: '#00ffff',
      512: '#0080ff',
      1024: '#0000ff',
      2048: '#8000ff',
      4096: '#ff00ff',
      8192: '#ff0080',
      16384: '#ff0000',
    },
  },
};

// ==================== COMPONENTS ====================

// Tile Component
const Tile: React.FC<{ tile: Tile; size: number; theme: Theme }> = ({ tile, size, theme }) => {
  const cellSize = 100 / size;
  const gap = cellSize * 0.05;
  const tileSize = cellSize - gap * 2;

  const x = tile.col * cellSize + gap;
  const y = tile.row * cellSize + gap;

  const tileColor = themes[theme].tiles[tile.value] || themes[theme].tiles[2];
  const fontSize = tile.value >= 1024 ? 1.5 : tile.value >= 128 ? 2 : 2.5;

  return (
    <div
      className={`tile ${tile.justMerged ? 'tile-merge' : ''} ${tile.isNew ? 'tile-spawn' : ''}`}
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: `${tileSize}%`,
        height: `${tileSize}%`,
        backgroundColor: tileColor,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: `${fontSize}rem`,
        color: tile.value > 4 ? '#fff' : themes[theme].text,
        transition: 'left 250ms cubic-bezier(0.4, 0.0, 0.2, 1), top 250ms cubic-bezier(0.4, 0.0, 0.2, 1), transform 250ms cubic-bezier(0.4, 0.0, 0.2, 1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        willChange: 'left, top, transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    >
      {tile.value}
    </div>
  );
};

// Enhanced Particle Layer with shapes
const ParticleLayer: React.FC<{ particles: Particle[] }> = ({ particles }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      {particles.map((p) => {
        const isFirework = p.type === 'firework';
        const isSpark = p.type === 'spark';
        const isTrail = p.type === 'trail';
        const isStar = p.type === 'star';
        const isHeart = p.type === 'heart';
        const isRing = p.type === 'ring';
        const isTriangle = p.type === 'triangle';

        let boxShadow = `0 0 ${p.size}px ${p.color}`;

        if (isFirework) {
          boxShadow = `
            0 0 ${p.size * 2}px ${p.color},
            0 0 ${p.size * 4}px ${p.color},
            0 0 ${p.size * 6}px ${p.color}
          `;
        } else if (isSpark) {
          boxShadow = `
            0 0 8px #ffffff,
            0 0 12px #ffffff,
            0 0 16px #ffffff
          `;
        } else if (isTrail) {
          boxShadow = `
            0 0 ${p.size * 3}px ${p.color},
            0 0 ${p.size * 6}px ${p.color}
          `;
        } else if (isStar) {
          boxShadow = `
            0 0 ${p.size * 2}px ${p.color},
            0 0 ${p.size * 4}px ${p.color}
          `;
        } else if (isHeart) {
          boxShadow = `
            0 0 ${p.size * 2.5}px ${p.color},
            0 0 ${p.size * 5}px ${p.color}
          `;
        } else if (isRing) {
          boxShadow = `
            0 0 ${p.size * 3}px ${p.color},
            0 0 ${p.size * 6}px ${p.color}
          `;
        } else if (isTriangle) {
          boxShadow = `
            0 0 ${p.size * 2.5}px ${p.color},
            0 0 ${p.size * 5}px ${p.color}
          `;
        }

        let shape = 'circle';
        if (isStar) shape = 'star';
        else if (isHeart) shape = 'heart';
        else if (isRing) shape = 'ring';
        else if (isTriangle) shape = 'triangle';

        // Pulse effect for hearts
        let pulseScale = 1;
        if (isHeart && p.pulsePhase !== undefined) {
          pulseScale = 1 + Math.sin(p.pulsePhase) * 0.3;
        }

        const transform = `
          translate(-50%, -50%) 
          rotate(${p.rotation || 0}rad) 
          scale(${pulseScale})
        `;

        // Render different shapes
        if (shape === 'star') {
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: Math.min(p.life, 1),
                pointerEvents: 'none',
                transform,
                filter: 'brightness(1.2)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: p.color,
                  clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                  boxShadow,
                }}
              />
            </div>
          );
        } else if (shape === 'heart') {
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: Math.min(p.life, 1),
                pointerEvents: 'none',
                transform,
                filter: 'brightness(1.3)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: p.color,
                  clipPath: 'path("M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")',
                  boxShadow,
                }}
              />
            </div>
          );
        } else if (shape === 'ring') {
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                border: `${Math.max(2, p.size / 4)}px solid ${p.color}`,
                borderRadius: '50%',
                opacity: Math.min(p.life, 1),
                pointerEvents: 'none',
                transform,
                boxShadow,
                filter: 'brightness(1.4)',
              }}
            />
          );
        } else if (shape === 'triangle') {
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: Math.min(p.life, 1),
                pointerEvents: 'none',
                transform,
                filter: 'brightness(1.3)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: p.color,
                  clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                  boxShadow,
                }}
              />
            </div>
          );
        }

        // Default circle
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              borderRadius: '50%',
              opacity: Math.min(p.life, 1),
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
              boxShadow,
              filter: isFirework || isSpark ? 'brightness(1.2)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

// Board Component
const Board: React.FC<{
  tiles: Tile[];
  size: number;
  theme: Theme;
  particles: Particle[];
}> = ({ tiles, size, theme, particles }) => {
  const cellSize = 100 / size;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '100%',
        backgroundColor: themes[theme].boardBg,
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* Grid cells */}
        {Array.from({ length: size * size }).map((_, i) => {
          const row = Math.floor(i / size);
          const col = i % size;
          const gap = cellSize * 0.05;
          const x = col * cellSize + gap;
          const y = row * cellSize + gap;
          const tileSize = cellSize - gap * 2;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: `${tileSize}%`,
                height: `${tileSize}%`,
                backgroundColor: themes[theme].cellBg,
                borderRadius: '8px',
              }}
            />
          );
        })}

        {/* Tiles */}
        {tiles.map((tile) => (
          <Tile key={tile.id} tile={tile} size={size} theme={theme} />
        ))}

        {/* Particles */}
        <ParticleLayer particles={particles} />
      </div>
    </div>
  );
};

// HUD Component
const HUD: React.FC<{
  score: number;
  highScore: number;
  moves: number;
  comboCount: number;
  undosRemaining: number;
  soundEnabled: boolean;
  theme: Theme;
  onRestart: () => void;
  onUndo: () => void;
  onToggleSound: () => void;
  onToggleTheme: () => void;
  onShowStats: () => void;
}> = ({
  score,
  highScore,
  moves,
  comboCount,
  undosRemaining,
  soundEnabled,
  theme,
  onRestart,
  onUndo,
  onToggleSound,
  onToggleTheme,
  onShowStats,
}) => {
  return (
    <div
      style={{
        marginBottom: '20px',
      }}
    >
      {/* Top Row: Score and Best */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            background: themes[theme].boardBg,
            padding: '16px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '4px', fontWeight: '600', letterSpacing: '0.5px' }}>
            SCORE
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{score}</div>
        </div>
        <div
          style={{
            background: themes[theme].boardBg,
            padding: '16px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '4px', fontWeight: '600', letterSpacing: '0.5px' }}>
            BEST
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{highScore}</div>
        </div>
      </div>

      {/* Second Row: New and Undo buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={onRestart}
          className="game-button"
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: 'none',
            background: '#ff6b5a',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '700',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          New
        </button>
        <button
          onClick={onUndo}
          disabled={undosRemaining === 0}
          className="game-button"
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: 'none',
            background: undosRemaining > 0 ? '#ff6b5a' : themes[theme].cellBg,
            color: '#fff',
            cursor: undosRemaining > 0 ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '700',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            opacity: undosRemaining > 0 ? 1 : 0.4,
          }}
        >
          Undo
        </button>
      </div>

      {/* Bottom Row: Settings and extras */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={onToggleSound}
            className="game-button"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: themes[theme].boardBg,
              color: themes[theme].text,
              cursor: 'pointer',
              fontSize: '1.1rem',
            }}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            onClick={onToggleTheme}
            className="game-button"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: themes[theme].boardBg,
              color: themes[theme].text,
              cursor: 'pointer',
              fontSize: '1.1rem',
            }}
          >
            🎨
          </button>
          <button
            onClick={onShowStats}
            className="game-button"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: themes[theme].boardBg,
              color: themes[theme].text,
              cursor: 'pointer',
              fontSize: '1.1rem',
            }}
          >
            📊
          </button>
        </div>

        <div
          style={{
            background: themes[theme].boardBg,
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}
        >
          {moves} moves
        </div>
      </div>

      {/* Combo badge - positioned absolutely so it doesn't push layout */}
      {comboCount > 1 && (
        <div
          className="combo-badge"
          style={{
            position: 'absolute',
            top: '120px',
            right: '20px',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
            padding: '12px 20px',
            borderRadius: '8px',
            animation: 'pulse 0.6s ease-in-out infinite',
            boxShadow: '0 4px 16px rgba(255,107,107,0.5)',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: '0.75rem', marginBottom: '2px' }}>COMBO</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>×{comboCount}</div>
        </div>
      )}
    </div>
  );
};
          🔄 New Game
        </button>
      </div>
    </div>
  );
};

// Stats Modal
const StatsModal: React.FC<{
  stats: Stats;
  onClose: () => void;
  theme: Theme;
}> = ({ stats, onClose }) => {
  const winRate = stats.gamesPlayed > 0 ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1) : '0';

  const achievements = [
    { name: 'First Steps', desc: 'Play your first game', unlocked: stats.gamesPlayed >= 1 },
    { name: 'Winner!', desc: 'Reach the 2048 tile', unlocked: stats.highestTile >= 2048 },
    { name: 'Combo Master', desc: 'Get a 5x combo', unlocked: stats.bestCombo >= 5 },
    { name: 'High Roller', desc: 'Score over 10,000 points', unlocked: stats.totalScore >= 10000 },
    { name: 'Dedicated', desc: 'Play 10 games', unlocked: stats.gamesPlayed >= 10 },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a2e',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '24px', fontSize: '2rem' }}>📊 Statistics</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Games Played</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.gamesPlayed}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Win Rate</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{winRate}%</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Total Score</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalScore.toLocaleString()}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Best Combo</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>×{stats.bestCombo}</div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px', fontSize: '1.2rem' }}>🏆 Achievements</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {achievements.map((ach) => (
              <div
                key={ach.name}
                style={{
                  background: ach.unlocked ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.05)',
                  padding: '12px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: ach.unlocked ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: '600' }}>{ach.name}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{ach.desc}</div>
                </div>
                <div style={{ fontSize: '1.5rem' }}>{ach.unlocked ? '✓' : '🔒'}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

// Main App
function App() {
  const boardSize = 4;
  const [engine, setEngine] = useState<GameEngine>(() => initGame(boardSize));
  const [particles, setParticles] = useState<Particle[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState<Theme>('dark');
  const [showStats, setShowStats] = useState(false);
  const [showStartButton, setShowStartButton] = useState(true);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const initializeAudio = useCallback(() => {
    audioSystem.init();
    
    if (audioSystem.context && audioSystem.context.state === 'suspended') {
      audioSystem.context.resume();
    }
    
    // Play silent sound to unlock
    if (soundEnabled && audioSystem.context && audioSystem.masterGain) {
      const osc = audioSystem.context.createOscillator();
      const gain = audioSystem.context.createGain();
      gain.gain.value = 0.01;
      osc.connect(gain);
      gain.connect(audioSystem.masterGain);
      osc.start();
      osc.stop(audioSystem.context.currentTime + 0.01);
    }
    
    setShowStartButton(false);
  }, [soundEnabled]);

  useEffect(() => {
    if (soundEnabled) audioSystem.init();
    audioSystem.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prev) => updateParticles(prev));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (engine.state.gameOver) return;

      const oldState = JSON.parse(JSON.stringify(engine.state));
      const moved = move(engine, direction, boardSize);

      if (moved) {
        triggerHaptic('light'); // Haptic for tile movement
        if (soundEnabled) audioSystem.playMove();

        const mergedTiles = engine.state.tiles.filter((t) => t.justMerged);

        mergedTiles.forEach((tile) => {
          const cellSize = 100 / boardSize;
          const gap = cellSize * 0.05;
          const x = tile.col * cellSize + cellSize / 2;
          const y = tile.row * cellSize + cellSize / 2;
          const color = themes[theme].tiles[tile.value] || '#fff';

          // Use enhanced fireworks for 32+
          if (tile.value >= 32) {
            triggerHaptic(tile.value >= 128 ? 'heavy' : 'medium'); // Stronger haptic for higher tiles
            const newParticles = createEnhancedFireworks(x, y, tile.value, color);
            setParticles((prev) => [...prev, ...newParticles]);
            if (soundEnabled) audioSystem.playMerge(tile.value, engine.state.comboCount);
          } else {
            triggerHaptic('light'); // Light haptic for smaller merges
          }
        });

        if (engine.state.comboCount > 1 && soundEnabled) {
          triggerHaptic('medium'); // Haptic for combos
          audioSystem.playCombo(engine.state.comboCount);
        }

        engine.history.push(oldState);
        if (engine.history.length > 10) engine.history.shift();

        setEngine({ ...engine });

        if (engine.state.won && soundEnabled) {
          setTimeout(() => audioSystem.playWin(), 300);
        } else if (engine.state.gameOver && soundEnabled) {
          setTimeout(() => audioSystem.playGameOver(), 300);
        }
      }
    },
    [engine, soundEnabled, theme, boardSize]
  );

  const handleRestart = () => {
    const stats = loadStats();
    stats.gamesPlayed++;
    if (engine.state.won) stats.gamesWon++;
    stats.totalScore += engine.state.score;
    stats.bestCombo = Math.max(stats.bestCombo, engine.state.comboCount);
    const highestTile = Math.max(...engine.state.tiles.map((t) => t.value));
    stats.highestTile = Math.max(stats.highestTile, highestTile);
    saveStats(stats);

    setEngine(initGame(boardSize));
    setParticles([]);
  };

  const handleUndo = () => {
    if (engine.undosRemaining > 0 && engine.history.length > 0) {
      const previousState = engine.history.pop()!;
      engine.state = previousState;
      engine.undosRemaining--;
      setEngine({ ...engine });
      setParticles([]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const dirMap: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      };

      if (dirMap[e.key]) {
        e.preventDefault();
        handleMove(dirMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // Prevent page scrolling
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault(); // Prevent page scrolling
      if (!touchStartRef.current) return;

      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) >= 30) {
          handleMove(deltaX > 0 ? 'right' : 'left');
        }
      } else {
        if (Math.abs(deltaY) >= 30) {
          handleMove(deltaY > 0 ? 'down' : 'up');
        }
      }

      touchStartRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleMove]);

  const cycleTheme = () => {
    const themes: Theme[] = ['dark', 'light', 'neon'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: themes[theme].background,
        color: themes[theme].text,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: '600px', width: '100%', position: 'relative' }}>
        <h1
          style={{
            textAlign: 'center',
            fontSize: '3rem',
            marginBottom: '8px',
            fontWeight: '800',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          Zipper Merge
        </h1>
        <p
          style={{
            textAlign: 'center',
            marginBottom: '20px',
            opacity: 0.8,
            fontSize: '0.95rem',
          }}
        >
          Use arrow keys or WASD to play. Combine tiles to reach 2048!
        </p>

        <HUD
          score={engine.state.score}
          highScore={engine.highScore}
          moves={engine.state.moves}
          comboCount={engine.state.comboCount}
          undosRemaining={engine.undosRemaining}
          soundEnabled={soundEnabled}
          theme={theme}
          onRestart={handleRestart}
          onUndo={handleUndo}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onToggleTheme={cycleTheme}
          onShowStats={() => setShowStats(true)}
        />

        <Board tiles={engine.state.tiles} size={boardSize} theme={theme} particles={particles} />

        {engine.state.gameOver && (
          <div
            style={{
              marginTop: '20px',
              padding: '20px',
              background: 'rgba(0,0,0,0.8)',
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>
              {engine.state.won ? '🎉 You Won!' : '💀 Game Over!'}
            </h2>
            <p style={{ marginBottom: '16px', opacity: 0.9 }}>
              Final Score: {engine.state.score}
            </p>
            <button
              onClick={handleRestart}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
              }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {showStats && (
        <StatsModal stats={loadStats()} onClose={() => setShowStats(false)} theme={theme} />
      )}

      {showStartButton && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            gap: '24px',
          }}
          onClick={initializeAudio}
        >
          <div style={{ fontSize: '4rem' }}>🎮</div>
          <h2 style={{ fontSize: '2rem', margin: 0, color: '#fff' }}>Zipper Merge</h2>
          <button
            style={{
              padding: '16px 48px',
              fontSize: '1.2rem',
              fontWeight: '600',
              border: 'none',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(102,126,234,0.4)',
            }}
          >
            Tap to Start
          </button>
          <p style={{ fontSize: '0.9rem', opacity: 0.7, color: '#fff' }}>
            {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
