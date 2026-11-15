export type SoundEffect = 'bet' | 'win' | 'loss' | 'cashout' | 'step' | 'click';

export interface SynthNote {
  freq: number;
  endFreq?: number;
  delay: number;
  duration: number;
  type: OscillatorType;
  gain: number;
}

export interface SoundProfile {
  effect: SoundEffect;
  label: string;
  notes: SynthNote[];
}

export const SOUND_MUTE_STORAGE_KEY = 'ranwin_sound_muted';

export const SOUND_PROFILES: Record<SoundEffect, SoundProfile> = {
  bet: {
    effect: 'bet',
    label: 'Bet Placed',
    notes: [
      { freq: 740, endFreq: 980, delay: 0, duration: 0.055, type: 'triangle', gain: 0.14 },
      { freq: 1174.66, endFreq: 1318.51, delay: 0.045, duration: 0.075, type: 'sine', gain: 0.12 },
    ],
  },
  step: {
    effect: 'step',
    label: 'Safe Step / Ring Spin',
    notes: [
      { freq: 659.25, endFreq: 880, delay: 0, duration: 0.06, type: 'sine', gain: 0.12 },
      { freq: 1046.5, delay: 0.04, duration: 0.065, type: 'triangle', gain: 0.08 },
    ],
  },
  win: {
    effect: 'win',
    label: 'Winning Outcome',
    notes: [
      { freq: 523.25, delay: 0, duration: 0.11, type: 'triangle', gain: 0.14 },
      { freq: 659.25, delay: 0.08, duration: 0.11, type: 'triangle', gain: 0.14 },
      { freq: 783.99, delay: 0.16, duration: 0.12, type: 'triangle', gain: 0.15 },
      { freq: 1046.5, delay: 0.24, duration: 0.26, type: 'sine', gain: 0.18 },
      { freq: 1318.51, delay: 0.32, duration: 0.28, type: 'sine', gain: 0.12 },
    ],
  },
  cashout: {
    effect: 'cashout',
    label: 'Instant Cashout',
    notes: [
      { freq: 783.99, delay: 0, duration: 0.09, type: 'sine', gain: 0.14 },
      { freq: 987.77, delay: 0.065, duration: 0.09, type: 'sine', gain: 0.14 },
      { freq: 1174.66, delay: 0.13, duration: 0.11, type: 'triangle', gain: 0.15 },
      { freq: 1567.98, delay: 0.2, duration: 0.24, type: 'sine', gain: 0.16 },
    ],
  },
  loss: {
    effect: 'loss',
    label: 'Loss / Crash Outcome',
    notes: [
      { freq: 246.94, endFreq: 196.0, delay: 0, duration: 0.16, type: 'sawtooth', gain: 0.09 },
      { freq: 174.61, endFreq: 110.0, delay: 0.13, duration: 0.26, type: 'triangle', gain: 0.14 },
    ],
  },
  click: {
    effect: 'click',
    label: 'UI Tap',
    notes: [
      { freq: 580, endFreq: 480, delay: 0, duration: 0.035, type: 'sine', gain: 0.08 },
    ],
  },
};

export function getSoundProfile(effect: SoundEffect): SoundProfile {
  return SOUND_PROFILES[effect];
}

export function getProfileDurationMs(effect: SoundEffect): number {
  const profile = SOUND_PROFILES[effect];
  return Math.round(
    profile.notes.reduce((max, n) => Math.max(max, (n.delay + n.duration) * 1000), 0)
  );
}

type MuteListener = (muted: boolean) => void;

class SoundEffectEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private listeners: Set<MuteListener> = new Set();

  constructor() {
    this.muted = this.readInitialMuted();
  }

  private readInitialMuted(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(SOUND_MUTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(nextMuted: boolean): boolean {
    this.muted = nextMuted;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SOUND_MUTE_STORAGE_KEY, nextMuted ? '1' : '0');
      } catch {
        // ignore storage errors
      }
    }
    for (const listener of this.listeners) {
      listener(nextMuted);
    }
    return this.muted;
  }

  public toggleMute(): boolean {
    return this.setMuted(!this.muted);
  }

  public subscribe(listener: MuteListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public play(effect: SoundEffect): boolean {
    if (this.muted) return false;
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    const profile = SOUND_PROFILES[effect];
    const now = ctx.currentTime;

    for (const note of profile.notes) {
      try {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = note.type;

        const startAt = now + note.delay;
        const stopAt = startAt + note.duration;

        osc.frequency.setValueAtTime(note.freq, startAt);
        if (note.endFreq && note.endFreq > 0) {
          osc.frequency.exponentialRampToValueAtTime(note.endFreq, stopAt);
        }

        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.linearRampToValueAtTime(note.gain, startAt + Math.min(0.015, note.duration * 0.25));
        gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(startAt);
        osc.stop(stopAt + 0.01);
      } catch {
        // ignore isolated audio node errors
      }
    }
    return true;
  }
}

export const soundEngine = new SoundEffectEngine();

export function playSound(effect: SoundEffect): boolean {
  return soundEngine.play(effect);
}

export function isSoundMuted(): boolean {
  return soundEngine.isMuted();
}

export function toggleSoundMute(): boolean {
  return soundEngine.toggleMute();
}
