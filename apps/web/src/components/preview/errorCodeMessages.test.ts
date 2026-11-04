import { describe, expect, it } from "vite-plus/test";

import { localNetworkHint } from "./errorCodeMessages";
import { isLocalNetworkHost } from "./previewConstants";

describe("isLocalNetworkHost", () => {
  it("recognizes the private IPv4 ranges a local-network block affects", () => {
    for (const url of [
      "http://192.168.15.27:5173",
      "http://10.0.0.4",
      "http://172.16.0.1",
      "http://172.31.255.254",
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
      "http://localhost:3000",
      "http://mac-mini.local:5173",
    ]) {
      expect(isLocalNetworkHost(url), url).toBe(true);
    }
  });

  it("leaves public addresses alone", () => {
    for (const url of [
      "https://example.com",
      "https://172.32.0.1",
      "https://8.8.8.8",
      "not a url",
    ]) {
      expect(isLocalNetworkHost(url), url).toBe(false);
    }
  });
});

describe("localNetworkHint", () => {
  const blocked = {
    url: "http://192.168.15.27:5173",
    code: -109,
    description: "ERR_ADDRESS_UNREACHABLE",
  };

  it("explains a macOS local-network block for a private host", () => {
    expect(localNetworkHint({ ...blocked, isMacosClient: true })).toContain("Rede Local");
  });

  it("stays quiet off macOS, off the local network, and for unrelated failures", () => {
    expect(localNetworkHint({ ...blocked, isMacosClient: false })).toBeNull();
    expect(
      localNetworkHint({ ...blocked, isMacosClient: true, url: "https://example.com" }),
    ).toBeNull();
    expect(
      localNetworkHint({
        ...blocked,
        isMacosClient: true,
        code: -106,
        description: "ERR_INTERNET_DISCONNECTED",
      }),
    ).toBeNull();
  });
});
