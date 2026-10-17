# Mighty Mower 🚜

A happy, frustration-free lawn mowing game for little kids, made for iPad and iPhone.

- Touch anywhere and the mower drives to your finger.
- Animals, flowers, and stars are hidden in the grass.
- Finish a lawn to earn stars, which unlock new mowers.
- The sticker book collects everything you find.
- You can't lose. There are no timers, and the last few bits of grass mow themselves.

## Run it locally

```bash
npm install
npm start
```

Open http://localhost:4000.

### Play on an iPad or iPhone over Wi-Fi

`npm start` also listens on your local network. Vite prints a `Network:` address such as `http://192.168.1.20:4000`. Open it in Safari on a device on the same Wi-Fi.

## Deploy to GitHub Pages

The game must be **built** before it's published. GitHub Pages can't run the source files directly: you'd get a blank green screen and a plain letter icon.

```bash
npm run deploy
```

This builds the game and pushes the finished files to a `gh-pages` branch. The first time, go to **Settings → Pages → Build and deployment** and set **Source** to **Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**. The site appears at `https://<you>.github.io/<repo>/` a minute or so after each deploy.

> Prefer automatic deploys on every push? [.github/workflows/deploy.yml](.github/workflows/deploy.yml) does that with GitHub Actions. Re-enable its `push` trigger and set the Pages source to **GitHub Actions**. This needs Actions to be usable on your account.

To check the production build locally:

```bash
npm run build
npm run preview
```

## Tips for parents

- **Make it feel like an app:** in Safari, tap **Share → Add to Home Screen**. The game then opens full screen with its own icon.
- **No sound on iPhone?** Check the silent/ring switch. iOS mutes web audio when the phone is silenced.
- **Lock the child in:** turn on **Guided Access** (Settings → Accessibility → Guided Access), then triple-click the side button while the game is open.
- **Sound buttons:** the 🔊 and 🎵 buttons on the title screen turn off all sound or just the music.
- **Saved progress:** stars, mowers, and stickers are saved on the device in the browser's storage.
- **Start over:** to reset progress, open the browser console and run `localStorage.clear()`, or clear the website data for the site.

## How it's built

The game uses Vite, plain JavaScript, and HTML5 Canvas. All the art is drawn in code or uses emoji, and every sound is made with the Web Audio API, so there are no image or audio files to manage.

| File | What it does |
| --- | --- |
| `src/main.js` | Boot, resize handling, game loop, screen switching |
| `src/lawn.js` | Grass grid, lawn shapes, cutting, obstacles, hidden surprises |
| `src/mower.js` | Mower movement (follows the finger) and drawing |
| `src/levels.js` | The endless lawn sequence (size, shape, world, obstacles) |
| `src/themes.js` | Worlds: sunny day, sunset, night, candy land, moon |
| `src/catalog.js` | Stickers (hidden surprises) and unlockable mowers |
| `src/screens/` | Title menu, play screen, celebration, garage, sticker book |
| `src/audio.js`, `src/music.js`, `src/speech.js` | Synthesized sound effects, background music, spoken praise |
