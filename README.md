# Mighty Mower 🚜

A happy, frustration-free lawn mowing game for little kids, made for iPad and iPhone.

- Touch anywhere and the mower drives to your finger.
- Animals, flowers, and stars are hidden in the grass.
- Finish a lawn to earn stars, which unlock new mowers.
- The sticker book collects everything you find.
- Every third lawn is a giant one that fills the whole screen.
- You can't lose. There are no timers, and the last few bits of grass mow themselves.

## Run it locally

It's plain HTML and JavaScript with no build step and no dependencies to install. Just run:

```sh
npm start
```

Then open http://localhost:4000 in your browser. It also prints a `http://192.168.x.x:4000` address you can open on an iPad or iPhone on the same Wi-Fi. Use `PORT=8080 npm start` for a different port.

Caching is turned off, so a refresh always shows your latest changes.

## Put it on GitHub Pages

1. Push this repo to GitHub.
2. On GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then click **Save**.
3. After about a minute it's live at `https://<your-username>.github.io/lawn-mower/`. Every push to `main` updates it.

## Make it feel like an app (iPad / iPhone)

1. Open the link in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch it from the new icon. It opens full screen.

Tips:

- **Lock the child in:** turn on **Guided Access** (Settings → Accessibility → Guided Access). Triple-click the side or home button to start it.
- **No sound on iPhone?** Flip the ring/silent switch off.
- **Sound buttons:** the 🔊 and 🎵 buttons on the title screen turn off all sound or just the music.
- **Changed icon not showing?** iOS caches home-screen icons. Delete the shortcut and add it again.
- **Start over:** stars, mowers, and stickers are saved in the browser. To reset them, run `localStorage.clear()` in the browser console.

## Files

- `index.html`: page setup, iOS full-screen settings
- `src/main.js`: boot, resize handling, game loop, screen switching
- `src/lawn.js`: grass grid, lawn shapes, cutting, obstacles, hidden surprises
- `src/mower.js`: mower movement (follows the finger) and drawing
- `src/levels.js`: the endless lawn sequence (size, shape, world, obstacles)
- `src/themes.js`: worlds (sunny day, sunset, night, candy land, moon)
- `src/catalog.js`: stickers (hidden surprises) and unlockable mowers
- `src/screens/`: title menu, play screen, celebration, garage, sticker book
- `src/audio.js`, `src/music.js`, `src/speech.js`: sound effects, background music, and spoken praise, all generated in code
- `scripts/serve.js`: the local test server behind `npm start`
- `icons/`: home-screen icons
