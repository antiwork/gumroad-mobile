import * as Sharing from "expo-sharing";

const CONCURRENT_SHARE_MESSAGE = "Another share request is being processed";

let shareInFlight = false;

export const shareFile = async (uri: string, options?: Sharing.SharingOptions) => {
  if (shareInFlight) return;
  shareInFlight = true;
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) throw new Error("Sharing is not available on this device");
    await (options ? Sharing.shareAsync(uri, options) : Sharing.shareAsync(uri));
  } catch (error) {
    if (error instanceof Error && error.message.includes(CONCURRENT_SHARE_MESSAGE)) return;
    throw error;
  } finally {
    shareInFlight = false;
  }
};
