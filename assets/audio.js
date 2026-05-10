// 这是一个基于纯原生 Web Audio API 编写的“程序化音效发生器”
// 不需要任何 MP3/WAV 资源文件，所有声音都是通过数学公式和声波实时合成的！

let audioCtx = null;

// 初始化音频引擎（必须由用户的真实点击触发）
export function initAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      console.log('[Audio] Context created:', audioCtx.state);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        console.log('[Audio] Context resumed, state:', audioCtx.state);
      });
    }
  } catch (e) {
    console.error('[Audio] Init error:', e);
  }
}

export function isAudioEnabled() {
  return audioCtx && audioCtx.state === 'running';
}

// 挖开方块的音效：清脆的“啵”声 (Sine Wave 升频)
export function playPop() {
  if (!audioCtx) return;
  // 如果状态是 suspended，尝试在播放前 resume（虽然可能由于缺少 gesture 失败，但不应直接 return）
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
  
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

// 踩雷的音效：沉闷的低音爆炸 (白噪音 + 低通滤波)
export function playExplosion() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const bufferSize = audioCtx.sampleRate * 0.5; // 0.5s duration
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // 生成白噪音
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  
  // 添加低通滤波器让爆炸声变沉闷
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
  
  // 音量衰减
  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
  
  noiseSource.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  noiseSource.start();
}

// 插旗音效：高频率短促的“滴”声 (Triangle Wave)
export function playFlag() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.03);
  
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.03);
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.03);
}
