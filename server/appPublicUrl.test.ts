import { describe, expect, it } from "vitest";

describe("APP_PUBLIC_URL", () => {
  it("usa o domínio canônico HTTPS configurado para produção", () => {
    const rawUrl = process.env.APP_PUBLIC_URL;
    expect(rawUrl).toBe("https://defocusapp.com");

    const publicUrl = new URL(rawUrl!);
    expect(publicUrl.protocol).toBe("https:");
    expect(publicUrl.hostname).toBe("defocusapp.com");
  });
});
