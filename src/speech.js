// Friendly spoken words for a player who can't read yet.
let enabled = true;
let last = 0;
let voice = null;
let unlocked = false;

function synth() {
  return typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
}

function chooseVoice() {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  return (
    en.find((v) => /Samantha|Karen|Moira|Tessa|Google US English|Aria|Jenny/i.test(v.name)) ||
    en.find((v) => /en[-_]US/i.test(v.lang)) ||
    en[0] ||
    null
  );
}

if (synth()) {
  synth().addEventListener?.('voiceschanged', () => {
    voice = chooseVoice();
  });
}

// iOS only allows speech after it is first used inside a user gesture.
export function unlockSpeech() {
  const s = synth();
  if (!s || unlocked) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  } catch {
    /* ignore */
  }
}

export function setSpeechEnabled(on) {
  enabled = on;
  if (!on) synth()?.cancel();
}

export function say(text, { force = false, pitch = 1.3, rate = 0.95 } = {}) {
  const s = synth();
  if (!s || !enabled) return;
  const now = performance.now();
  if (!force && now - last < 2200) return;
  last = now;
  try {
    if (force) s.cancel();
    if (!voice) voice = chooseVoice();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.pitch = pitch;
    u.rate = rate;
    u.volume = 1;
    s.speak(u);
  } catch {
    /* ignore */
  }
}
