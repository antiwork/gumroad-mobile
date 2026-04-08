import { useEffect, useState } from "react";
import { type AudioTrack, getActiveTrack, on, off } from "@/lib/audio-player";

export const useActiveTrack = (): AudioTrack | null => {
  const [track, setTrack] = useState<AudioTrack | null>(getActiveTrack());

  useEffect(() => {
    const handleTrackChange = (newTrack?: AudioTrack) => {
      setTrack(newTrack ?? null);
    };
    on("trackChange", handleTrackChange);
    return () => {
      off("trackChange", handleTrackChange);
    };
  }, []);

  return track;
};
