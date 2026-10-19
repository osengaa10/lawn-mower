# Mighty Mower 🚜

A happy, frustration-free lawn mowing game for little kids, made for iPad and iPhone.

- Touch anywhere and the mower drives to your finger. The lawn is a little 3D world seen from above, with real shadows, swaying grass and animated animal friends.
- The title screen is a little 3D front yard where your mower cuts stripes while the puppy follows along.
- Mowing leaves real stripes: the grass leans the way you drove, so back-and-forth rows come out light and dark like a fresh lawn, and driving over cut grass again redraws them. A soft hum and grass swish, a gentle chime for every finished row, and calm music keep it relaxing.
- Every lawn hides a giant picture (a dinosaur, a rocket, a kitty...). Mowing uncovers it. At the end the camera drifts quietly over the new stripes, then swoops up to show it off.
- Each lawn belongs to someone's house. Finished lawns stay on a street you can swipe back along to see every picture.
- Animal friends live on the lawn: a puppy follows the mower, bunnies hop out of the way, owls fly off. The 📣 horn makes everyone jump.
- Glowing power-ups: 🍄 makes the mower GIANT, ⚡ is a turbo boost, 🫧 blows bubbles.
- Partway through every other lawn there's a surprise: a balloon drops a present, sprinklers pop up, a cow comes to help, or stars and candy fall from the sky.
- Later lawns have hills and wooden ramps to jump off.
- Animals, flowers, and stars are hidden in the grass. The sticker book collects everything you find.
- Finish a lawn to earn stars, which unlock new mowers. Every third lawn is a giant one.
- You can't lose. There are no timers, and the last few bits of grass mow themselves.

## Run it locally

It's plain HTML and JavaScript with no build step and no dependencies to install. Just run:

```sh
npm start
```

Then open http://localhost:4000 in your browser. It also prints a `http://192.168.x.x:4000` address you can open on an iPad or iPhone on the same Wi-Fi. Use `PORT=8080 npm start` for a different port.

Caching is turned off, so a refresh always shows your latest changes. Offline mode only turns on for the published HTTPS site, not for local testing.

`npm test` checks that every game file is in the offline cache list in `sw.js`. If you add or remove a file, update `FILES` there and bump `CACHE`.

On a slow device the game turns its quality down by itself (fewer pixels, then no real shadows). `__game.debug.quality(0)` forces full quality, `2` the lowest.

## Put it on GitHub Pages

1. Push this repo to GitHub.
2. On GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then click **Save**.
3. After about a minute it's live at `https://<your-username>.github.io/lawn-mower/`. Every push to `main` updates it.

## Make it feel like an app (iPad / iPhone)

1. Open the link in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch it from the new icon. It opens full screen and works offline after the first launch.

Tips:

- **Lock the child in:** turn on **Guided Access** (Settings → Accessibility → Guided Access). Triple-click the side or home button to start it.
- **No sound on iPhone?** Flip the ring/silent switch off.
- **Sound buttons:** the 🔊 and 🎵 buttons on the title screen turn off all sound or just the music.
- **Changed icon not showing?** iOS caches home-screen icons. Delete the shortcut and add it again.
- **Progress is saved on the device:** stars, mowers, stickers, the street, and even a half-mowed lawn. Closing the app mid-lawn picks up right where he left off.
- **The home-screen app and Safari keep separate progress.** Once he plays from the home-screen icon, keep using the icon.
- **Updates:** after you push an update, the game picks it up the second time it's opened.
- **Start over:** to reset progress, run `localStorage.clear()` in the browser console.

## Testing shortcuts

In the browser console:

- `__game.debug.goto(4)`: jump to lawn 4 (hills and a ramp start here)
- `__game.debug.power('giant')`: also `'turbo'` or `'bubbles'`
- `__game.debug.event('balloon')`: also `'sprinklers'`, `'cow'`, `'stars'` or `'candy'`
- `__game.debug.finish()`: finish the lawn (picture reveal, then the stars)
- `__game.debug.street()`: show the street

## Files

- `index.html`: page setup, iOS full-screen settings. Two canvases: the 3D world at the back, buttons and menus on top.
- `src/main.js`: boot, resize handling, game loop, screen switching, console test shortcuts
- `src/lawn.js`: lawn shapes, grass grid, cutting, obstacles, ramps, hidden surprises, power-up spots (all in grid cells)
- `src/terrain.js`: hills, ramps and other seeded numbers (no browser needed, so it's tested in Node)
- `src/mower.js`: mower movement (follows the finger, jumps off ramps), plus the flat drawing used in menus
- `src/levels.js`: the endless lawn sequence (size, shape, world, picture, owner, power-ups, surprise)
- `src/pictures.js`: the giant pictures hidden in each lawn
- `src/buddies.js`, `src/powerups.js`, `src/events.js`: animal friends and the horn, power-ups, mid-lawn surprises
- `src/themes.js`: worlds (sunny day, sunset, night, candy land, moon)
- `src/catalog.js`: stickers, unlockable mowers, house owners
- `src/world3d/`: the 3D side, built on three.js:
  - `renderer.js`: the shared renderer, lights, sky, shadows, materials and the automatic quality setting
  - `mower3d.js`: the ride-on mower model; `thumbs.js` draws it into the garage cards
  - `houses.js`: a house for every world (cottage, barn, log cabin, gingerbread, moon dome)
  - `scenery.js`: the yard (fences, trees, bushes, flower beds) and the obstacle models
  - `animals.js`, `models.js`: animated animal models, with an emoji cutout for any animal without one
  - `ground.js`, `grass.js`, `props.js`, `ambient3d.js`, `effects3d.js`, `camera.js`, `sprites.js`: the ground and its painted picture, tall grass, trees/rocks/ramps/power-ups, drifting butterflies and fireflies, particles, the play camera, emoji cutouts and shadows
- `src/screens/`: title menu, play screen, street, celebration, garage, sticker book
- `src/audio.js`, `src/music.js`, `src/speech.js`: sound effects, background music, and spoken words, all generated in code
- `vendor/three.module.min.js`: three.js r169 (the same copy as monster-truck). `vendor/addons/` has the matching r169 add-ons (glTF loader, meshopt decoder, skeleton utils, rounded boxes, room lighting)
- `assets/models/`: the animal models (CC0, by Quaternius). See `assets/CREDITS.md` for where each came from
- `sw.js`: offline support (caches the game after the first launch)
- `scripts/serve.js`: the local test server behind `npm start`
- `test/`: checks for `npm test`
- `icons/`: home-screen icons
