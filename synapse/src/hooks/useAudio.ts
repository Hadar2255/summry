import { useCallback } from 'react';
import { audio, type Cue } from '../utils/audio';
import { useStore } from './useStore';

export function useAudioCue() {
  const { state } = useStore();
  const enabled = state.settings.audioCues;
  return useCallback(
    (cue: Cue) => {
      if (enabled) audio.play(cue);
    },
    [enabled]
  );
}
