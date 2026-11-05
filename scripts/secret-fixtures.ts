// Test fixtures of the secret scans (#814): a fake private key, built at run time so no file of
// this repo carries a key for the history scan to find. Every key starts with the same BEGIN line.
import { randomBytes } from "node:crypto";

export const fakeKey = () =>
  [
    ["-----BEGIN", "RSA PRIVATE", "KEY-----"].join(" "),
    ...[0, 1, 2].map(() => randomBytes(48).toString("base64")),
    ["-----END", "RSA PRIVATE", "KEY-----"].join(" "),
    "",
  ].join("\n");
