type UploadedFile = { created_at?: string };

const uploadTime = (file: UploadedFile) => {
  const parsed = file.created_at ? Date.parse(file.created_at) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

// The purchase page lists audio files in the seller's page layout, which for a podcast catalog is
// newest episode first. Playback advances through the queue, so it has to be built from upload time.
export const orderAudioFilesChronologically = <T extends UploadedFile>(files: T[]): T[] =>
  [...files].sort((a, b) => uploadTime(a) - uploadTime(b));
