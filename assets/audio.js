// 这是一个基于纯原生 Web Audio API 编写的“程序化音效发生器”
// 不需要任何 MP3/WAV 资源文件，所有声音都是通过数学公式和声波实时合成的！

let audioCtx = null;
let audioUnlocked = false;
let unlockPromise = null;
let listenersInstalled = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    console.log('[Audio] Context created:', audioCtx.state);
  }
  return audioCtx;
}

function markUnlocked() {
  audioUnlocked = true;
}

// 初始化音频引擎（必须由用户的真实点击触发）
export function initAudio() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    unlockPromise = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    unlockPromise.then(() => {
      markUnlocked();
      console.log('[Audio] Context resumed, state:', ctx.state);
    }).catch((e) => {
      console.warn('[Audio] Resume failed:', e);
    });
    unlockAudio();
  } catch (e) {
    console.error('[Audio] Init error:', e);
  }
}

export function installAudioUnlockListeners() {
  if (typeof window === 'undefined') return;
  if (listenersInstalled) return;
  listenersInstalled = true;

  const unlock = () => initAudio();
  const options = { capture: true, passive: true };

  window.addEventListener('pointerdown', unlock, options);
  window.addEventListener('touchstart', unlock, options);
  window.addEventListener('keydown', unlock, options);
}

export function isAudioEnabled() {
  return audioCtx && audioCtx.state === 'running' && audioUnlocked;
}

function unlockAudio() {
  if (!audioCtx) return;

  const buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0);
  markUnlocked();
}

async function ensureAudioReady() {
  const ctx = getAudioContext();
  if (!ctx) return null;

  if (ctx.state === 'suspended') {
    try {
      unlockPromise = ctx.resume();
      await unlockPromise;
    } catch (e) {
      console.warn('[Audio] Resume failed:', e);
    }
  } else if (unlockPromise) {
    await unlockPromise.catch(() => {});
  }

  if (ctx.state !== 'running') return null;
  markUnlocked();
  return ctx;
}

// 挖开方块的音效：清脆的“啵”声 (Sine Wave 升频)
export async function playPop() {
  const ctx = await ensureAudioReady();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
  
  gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

// 踩雷的音效：沉闷的低音爆炸 (白噪音 + 低通滤波)
export async function playExplosion() {
  const ctx = await ensureAudioReady();
  if (!ctx) return;
  
  const bufferSize = ctx.sampleRate * 0.5; // 0.5s duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // 生成白噪音
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  // 添加低通滤波器让爆炸声变沉闷
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
  
  // 音量衰减
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  
  noiseSource.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  noiseSource.start();
}

// 插旗音效：高频率短促的“滴”声 (Triangle Wave)
export async function playFlag() {
  const ctx = await ensureAudioReady();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.03);
  
  gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.03);
}

// 错旗提示音：短促下滑的 buzz
export async function playMistake() {
  const ctx = await ensureAudioReady();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(260, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);

  gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}
