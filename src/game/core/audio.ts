import * as Phaser from 'phaser';

import type { GameSettings } from '../types';

export type AudioCategory = 'music' | 'sfx';
type VolumeAdjustableSound = Phaser.Sound.BaseSound & {
  setVolume?: (value: number) => unknown;
  volume?: number;
};

export interface StarterAudioAsset {
  kind: 'audio';
  key: string;
  url: string;
  category: AudioCategory;
  durationSeconds?: number;
  volume: number;
  loop: boolean;
  usage: string;
}

export interface GeneratedAudioCue {
  kind: 'generated-audio';
  key: string;
  category: AudioCategory;
  frequency: number;
  durationSeconds: number;
  volume: number;
  usage: string;
}

export const AUDIO_KEYS = {
  uiConfirm: 'ui-confirm'
} as const;

export type AudioKey = (typeof AUDIO_KEYS)[keyof typeof AUDIO_KEYS];

export const STARTER_AUDIO_ASSETS: StarterAudioAsset[] = [
  audio(AUDIO_KEYS.uiConfirm, 'sfx', '/assets/audio/sfx/ui-confirm.mp3', 0.38, false, 'menu confirmation cue')
];
export const STARTER_AUDIO_CUES: GeneratedAudioCue[] = [
  cue('starter-jump', 'sfx', 380, 0.08, 0.34, 'generated jump cue'),
  cue('starter-pickup', 'sfx', 720, 0.1, 0.38, 'generated pickup cue'),
  cue('starter-complete', 'sfx', 520, 0.18, 0.42, 'generated level complete cue'),
  cue('starter-deny', 'sfx', 160, 0.12, 0.28, 'generated blocked/deny cue')
];

let audioContext: AudioContext | null = null;

export function getEffectiveVolume(
  assetVolume: number,
  category: AudioCategory,
  settings: GameSettings
): number {
  if (settings.muted) {
    return 0;
  }

  return assetVolume * (category === 'music' ? settings.musicVolume : settings.sfxVolume);
}

export function playAudioAsset(
  scene: Phaser.Scene,
  asset: StarterAudioAsset,
  settings: GameSettings
): void {
  if (scene.sound.locked || !scene.cache.audio.exists(asset.key)) {
    return;
  }

  const volume = getEffectiveVolume(asset.volume, asset.category, settings);

  if (volume <= 0) {
    return;
  }

  scene.sound.play(asset.key, {
    loop: asset.loop,
    volume
  });
}

export function playAudioCue(scene: Phaser.Scene, key: AudioKey | string, settings: GameSettings): void {
  const asset = STARTER_AUDIO_ASSETS.find((candidate) => candidate.key === key);

  if (asset) {
    playAudioAsset(scene, asset, settings);
    return;
  }

  playGeneratedAudioCue(key, settings);
}

export function stopAudioAsset(scene: Phaser.Scene, key: string): void {
  scene.sound.stopByKey(key);
}

export function syncLoopingAudioAsset(
  scene: Phaser.Scene,
  key: AudioKey | string,
  settings: GameSettings
): void {
  const asset = STARTER_AUDIO_ASSETS.find((candidate) => candidate.key === key);

  if (!asset || !asset.loop || scene.sound.locked || !scene.cache.audio.exists(asset.key)) {
    return;
  }

  const volume = getEffectiveVolume(asset.volume, asset.category, settings);
  const existingSounds = scene.sound.getAll<VolumeAdjustableSound>(asset.key);
  const isAlreadyPlaying = existingSounds.some((sound) => sound.isPlaying);

  existingSounds.forEach((sound) => {
    if (typeof sound.setVolume === 'function') {
      sound.setVolume(volume);
      return;
    }

    sound.volume = volume;
  });

  if (!isAlreadyPlaying && volume > 0) {
    scene.sound.play(asset.key, {
      loop: true,
      volume
    });
  }
}

export function playGeneratedAudioCue(
  key: string,
  settings: GameSettings,
  audioCtx: AudioContext = getAudioContext()
): void {
  const cueAsset = STARTER_AUDIO_CUES.find((candidate) => candidate.key === key);

  if (!cueAsset) {
    return;
  }

  const volume = getEffectiveVolume(cueAsset.volume, cueAsset.category, settings);

  if (volume <= 0) {
    return;
  }

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(cueAsset.frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + cueAsset.durationSeconds);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now + cueAsset.durationSeconds + 0.02);
}

/** Temple-bell partials: [frequency ratio to the fundamental, relative level, decay seconds]. */
const BELL_PARTIALS: Array<[number, number, number]> = [
  [1, 1, 1.6],
  [2.01, 0.55, 1.1],
  [2.76, 0.35, 0.8],
  [5.4, 0.18, 0.45],
  [8.93, 0.08, 0.25]
];

/**
 * Plays a synthesized temple-bell "dong" (a few decaying sine partials) — the
 * Golden Bell guard being struck. Respects mute and the SFX volume.
 * @param settings - Current audio settings.
 * @param fundamental - Base pitch in Hz.
 * @param audioCtx - Audio context to play on (defaults to the shared one).
 */
export function playBellStrike(settings: GameSettings, fundamental = 196, audioCtx?: AudioContext): void {
  const volume = getEffectiveVolume(0.32, 'sfx', settings);

  if (volume <= 0) {
    return;
  }

  const ctx = audioCtx ?? getAudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume, now);
  master.connect(ctx.destination);

  BELL_PARTIALS.forEach(([ratio, level, decay]) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(fundamental * ratio * (1 + (Math.random() - 0.5) * 0.004), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + decay + 0.05);
  });
}

/** Short synthesized arcade stings for the match announcer. */
export type ArcadeSting = 'round' | 'fight' | 'ko' | 'victory';

/**
 * Plays a synthesized arcade sting (no audio files needed): a gong for the
 * round call, a rising chord for FIGHT!, a deep boom with a noise crash for a
 * K.O., and a short major fanfare for the results screen. Respects mute and
 * the SFX volume.
 * @param settings - Current audio settings.
 * @param sting - Which sting to play.
 * @param audioCtx - Audio context to play on (defaults to the shared one).
 */
export function playArcadeSting(settings: GameSettings, sting: ArcadeSting, audioCtx?: AudioContext): void {
  const volume = getEffectiveVolume(0.3, 'sfx', settings);

  if (volume <= 0) {
    return;
  }

  const ctx = audioCtx ?? getAudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume, now);
  master.connect(ctx.destination);

  const tone = (type: OscillatorType, from: number, to: number, start: number, length: number, level: number): void => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now + start);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + start + length);
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(level, now + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now + start);
    oscillator.stop(now + start + length + 0.05);
  };

  const noise = (start: number, length: number, level: number): void => {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(level, now + start);
    source.connect(gain);
    gain.connect(master);
    source.start(now + start);
  };

  switch (sting) {
    case 'round':
      BELL_PARTIALS.forEach(([ratio, level, decay]) => tone('sine', 110 * ratio, 108 * ratio, 0, decay, level * 0.8));
      break;
    case 'fight':
      [262, 330, 392, 523].forEach((frequency, index) => tone('square', frequency, frequency, index * 0.05, 0.35, 0.18));
      noise(0, 0.25, 0.25);
      break;
    case 'ko':
      tone('sine', 140, 38, 0, 1.2, 1);
      tone('triangle', 90, 30, 0, 0.9, 0.6);
      noise(0, 0.7, 0.55);
      break;
    case 'victory':
      [523, 659, 784, 1047].forEach((frequency, index) => tone('square', frequency, frequency, index * 0.12, 0.3, 0.14));
      tone('square', 1047, 1047, 0.5, 0.8, 0.16);
      tone('triangle', 262, 262, 0.5, 0.8, 0.22);
      break;
  }
}

function cue(
  key: string,
  category: AudioCategory,
  frequency: number,
  durationSeconds: number,
  volume: number,
  usage: string
): GeneratedAudioCue {
  return {
    kind: 'generated-audio',
    key,
    category,
    frequency,
    durationSeconds,
    volume,
    usage
  };
}

function audio(
  key: AudioKey,
  category: AudioCategory,
  url: string,
  volume: number,
  loop: boolean,
  usage: string
): StarterAudioAsset {
  return {
    kind: 'audio',
    key,
    url,
    category,
    volume,
    loop,
    usage
  };
}

function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext();
  return audioContext;
}
