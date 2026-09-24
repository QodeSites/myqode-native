// Native multipart part for a picked file (camera, photo library, document picker).
//
// Expo's fetch (the global fetch since SDK 54) encodes FormData itself and accepts any part
// object exposing bytes() — see expo/src/winter/fetch/convertFormData.ts. React Native's own
// fetch (EXPO_PUBLIC_USE_RN_FETCH=1) instead wants { uri, name, type }. The object below
// satisfies both: `uri` for RN, `bytes()` for Expo, and the picker's name and MIME type as the
// part headers either way. The file is read with expo-file-system, which understands the
// file:// URIs the pickers return on Android and iOS (including Expo Go's percent-encoded
// cache paths). Kept out of api.js so that module stays loadable under plain node for tests.
import { File as FsFile } from 'expo-file-system';

export async function nativeFilePart(file) {
  const f = new FsFile(file.uri);
  return {
    uri: file.uri,
    name: file.name || f.name,
    type: file.mimeType || 'application/octet-stream',
    bytes: async () => new Uint8Array(await f.arrayBuffer()),
  };
}
