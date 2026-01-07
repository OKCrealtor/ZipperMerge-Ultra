# 🎮 Zipper Merge - Enhanced 2048 Game

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)

A beautiful, modern take on the classic 2048 game with **progressive fireworks effects** that get increasingly spectacular as you merge higher-value tiles!

## 🌐 Live Demo

**[Play the Game Live!](https://YOUR-USERNAME.github.io/zipper-merge-game/)**

*(Replace YOUR-USERNAME with your GitHub username after deploying)*

---

## ⭐ What Makes This Special

This isn't just another 2048 clone - it's been meticulously polished with:

✨ **Progressive Visual Effects** - Fireworks that evolve from simple to spectacular
🎨 **Three Beautiful Themes** - Dark, Light, and Neon modes
🔊 **Dynamic Audio** - Sounds that change with tile value and combos
📊 **Statistics Tracking** - Monitor your progress and achievements
↶ **Undo System** - 3 strategic undos per game
🎯 **Smooth Animations** - Butter-smooth tile movements and merges
📱 **Mobile Optimized** - Touch controls and responsive design
♿ **Accessible** - Keyboard navigation and reduced motion support

## ✨ Features

### 🎆 Progressive Fireworks System
- **32**: Rainbow burst + colorful trails
- **64**: + White sparks shooting upward
- **128**: + Rotating golden stars
- **256**: + Pulsing pink hearts
- **512**: + Expanding cyan rings
- **1024+**: + Spinning purple triangles

### 🎮 Gameplay Features
- Smooth tile animations
- Combo system with visual indicators
- Undo moves (3 per game)
- Multiple themes (Dark, Light, Neon)
- Sound effects with Web Audio API
- Touch and keyboard controls
- Persistent high scores and statistics
- Achievement system

### 📊 Statistics & Tracking
- Games played/won
- Total score
- Best combo
- Highest tile reached
- Win rate calculation
- 5 unique achievements

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- npm or yarn

### Installation

1. **Extract the folder**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Navigate to `http://localhost:5173`
   - Start playing!

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` folder.

## 🚀 Deploy to GitHub Pages

This project is configured for automatic deployment to GitHub Pages!

### Automatic Deployment (Recommended)

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository **Settings**
   - Navigate to **Pages** (left sidebar)
   - Under **Source**, select: **GitHub Actions**

3. **Wait for deployment:**
   - Check the **Actions** tab to see the deployment progress
   - Once complete, your game will be live at:
     `https://YOUR-USERNAME.github.io/zipper-merge-game/`

### Manual Deployment

```bash
# Build the project
npm run build

# Install gh-pages (if not already installed)
npm install --save-dev gh-pages

# Add deploy script to package.json
# Then run:
npm run deploy
```

**Important:** Make sure the `base` path in `vite.config.ts` matches your repository name!

## 🎮 How to Play

### Controls
- **Arrow Keys** or **WASD**: Move tiles
- **Touch**: Swipe in any direction (mobile)

### Objective
- Combine tiles with the same number
- Reach the **2048** tile to win
- Keep combining for higher scores!

### Tips
- Plan ahead - you have limited space
- Use the undo feature strategically (3 per game)
- Build combos for bonus points
- Watch for spectacular fireworks at 32+!

## 🎨 Themes

Switch between three beautiful themes:
1. **Dark** - Deep blues with vibrant tiles
2. **Light** - Classic beige board
3. **Neon** - Cyberpunk rainbow colors

## 🔊 Audio

The game features:
- Subtle move sounds
- Dynamic merge effects (pitch scales with tile value)
- Combo celebration sounds
- Victory fanfare
- Game over sound

Toggle audio on/off with the 🔊 button.

## 📱 Mobile Support

Fully responsive design with:
- Touch gesture controls
- Optimized layout for small screens
- Smooth animations on all devices

## 🏆 Achievements

Unlock 5 achievements:
- **First Steps**: Play your first game
- **Winner!**: Reach the 2048 tile
- **Combo Master**: Get a 5x combo
- **High Roller**: Score over 10,000 points
- **Dedicated**: Play 10 games

## 🛠️ Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Web Audio API** - Sound effects
- **CSS3** - Animations and styling

## 📂 Project Structure

```
zipper-merge-game/
├── src/
│   ├── App.tsx          # Main game component (1,900+ lines)
│   ├── App.css          # Animations and styles
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
└── README.md           # This file
```

## 🎆 Fireworks Breakdown

### Value 32
- 12 rainbow-colored firework particles
- 8 colorful trailing particles
- Radial burst pattern
- 1.6-1.8 second lifetime

### Value 64
- Everything from 32
- + 15 white sparks shooting upward
- Tighter cone angle
- Enhanced glow effects

### Value 128
- Everything from 64
- + 8 rotating golden stars
- Star-shaped particles
- Dynamic rotation animation

### Value 256
- Everything from 128
- + 6 pulsing pink hearts
- Heart-shaped particles
- Pulsing scale animation

### Value 512
- Everything from 256
- + 5 expanding cyan rings
- Ring-shaped (hollow circle) particles
- Radial expansion effect

### Value 1024+
- Everything from 512
- + 10 spinning purple triangles
- Triangle-shaped particles
- Spinning rotation animation
- Maximum spectacle!

## 🐛 Troubleshooting

### Fireworks not appearing?
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear browser cache
- Check browser console for errors

### Audio not working?
- Click anywhere on the page first (browsers require user interaction)
- Check that audio is enabled (🔊 button)
- Check browser permissions

### Performance issues?
- Close other tabs/applications
- Try the Light theme (fewer effects)
- Update your browser to the latest version

## 📝 License

This project is open source and available under the MIT License.

## 🎉 Credits

Created with ❤️ by Claude (Anthropic)
Inspired by the original 2048 by Gabriele Cirulli

---

**Enjoy the game! 🎮✨**

Merge tiles, create combos, and watch the spectacular fireworks! 🎆
