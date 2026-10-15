type UploadedFile = { created_at?: string };

const uploadTime = (file: UploadedFile) => {
  const parsed = file.created_at ? Date.parse(file.created_at) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

// A purchase page lists audio files in the seller's layout, which is a play order for an album or a
// course but a feed when it leads with the newest file (a podcast catalog). Only a feed is reordered.
export const orderAudioFilesForPlayback = <T extends UploadedFile>(files: T[]): T[] => {
  const leadsWithNewest = files.length > 1 && uploadTime(files[0]) > uploadTime(files[files.length - 1]);
  if (!leadsWithNewest) return files;

  return [...files].sort((a, b) => uploadTime(a) - uploadTime(b));
};
