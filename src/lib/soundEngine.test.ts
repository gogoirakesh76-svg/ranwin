import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOUND_PROFILES,
  getProfileDurationMs,
  getSoundProfile,
  isSoundMuted,
  playSound,
  soundEngine,
  toggleSoundMute,
  type SoundEffect,
} from './soundEngine.ts';

test('every sound effect has valid Web Audio synthesizer notes and durations', () => {
  const effects: SoundEffect[] = ['bet', 'step', 'win', 'cashout', 'loss', 'click'];
  for (const eff of effects) {
    const profile = getSoundProfile(eff);
    assert.equal(profile.effect, eff);
    assert.ok(profile.notes.length > 0, `${eff} must define at least one note`);
    for (const note of profile.notes) {
      assert.ok(note.freq > 0, `${eff} frequency must be positive`);
      assert.ok(note.duration > 0, `${eff} duration must be positive`);
      assert.ok(note.gain > 0 && note.gain <= 0.5, `${eff} gain must be safe`);
    }
    assert.ok(getProfileDurationMs(eff) >= 30);
  }
  assert.ok(SOUND_PROFILES.win.notes.length >= 4, 'win fanfare should have rising arpeggio');
  assert.ok(
    SOUND_PROFILES.loss.notes[0].freq > SOUND_PROFILES.loss.notes[SOUND_PROFILES.loss.notes.length - 1].freq,
    'loss cue should descend in pitch'
  );
});

test('sound engine mute state toggles and suppresses playback cleanly in non-DOM environments', () => {
  soundEngine.setMuted(false);
  assert.equal(isSoundMuted(), false);
  // In Node (no window.AudioContext), playSound returns false without throwing
  assert.equal(playSound('bet'), false);

  const mutedAfterToggle = toggleSoundMute();
  assert.equal(mutedAfterToggle, true);
  assert.equal(isSoundMuted(), true);
  assert.equal(playSound('win'), false);

  soundEngine.setMuted(false);
  assert.equal(isSoundMuted(), false);
});
