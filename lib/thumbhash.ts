import { thumbHashToDataURL } from "thumbhash";

function toBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

const dataUrls = new Map<string, string>();

/** The ThumbHash as a tiny blurred PNG data URL, decoded once per hash (spec 4.6). */
export function thumbHashDataUrl(hash: string): string {
  let url = dataUrls.get(hash);
  if (url === undefined) {
    url = thumbHashToDataURL(toBytes(hash));
    dataUrls.set(hash, url);
  }
  return url;
}
