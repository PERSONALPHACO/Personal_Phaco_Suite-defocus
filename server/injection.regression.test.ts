import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeCsvCell } from "./db";
import { sendNewDoctorNotification, sendPasswordResetEmail } from "./_core/email";
import { escapeHtml, sanitizePdfColor } from "./pdfGenerator";

describe("segurança do gerador de PDF", () => {
  it("escapa texto antes de inseri-lo no HTML", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & texto')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; texto"
    );
  });

  it("aceita cores explícitas e bloqueia expressões CSS que podem disparar rede", () => {
    expect(sanitizePdfColor("#2563eb")).toBe("#2563eb");
    expect(sanitizePdfColor("rgba(37, 99, 235, 0.7)")).toBe("rgba(37, 99, 235, 0.7)");
    expect(sanitizePdfColor("url(https://atacante.exemplo/pixel)")).toBe("#2563eb");
    expect(sanitizePdfColor("expression(alert(1))")).toBe("#2563eb");
  });
});

describe("segurança de templates de e-mail", () => {
  const originalResendKey = process.env.RESEND_API_KEY;
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key";
    fetchMock.mockResolvedValue({ ok: true, text: vi.fn() });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
    vi.clearAllMocks();
  });

  it("escapa dados de cadastro controlados pelo usuário no e-mail de admin", async () => {
    await sendNewDoctorNotification("admin@exemplo.com", "Admin <b>", {
      name: '<img src=x onerror="alert(1)">',
      email: "medico@example.com",
      registeredAt: new Date("2026-08-15T12:00:00Z"),
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.html).not.toContain('<img src=x onerror="alert(1)">');
    expect(payload.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(payload.html).toContain("Admin &lt;b&gt;");
  });

  it("recusa URL não HTTP(S) antes de gerar e-mail de redefinição", async () => {
    await expect(
      sendPasswordResetEmail("medico@exemplo.com", "Dra. Teste", "javascript:alert(1)")
    ).rejects.toThrow("URL de e-mail inválida");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("segurança da exportação CSV", () => {
  it.each(["=1+1", "+1+1", "-1+1", "@SUM(A1)", "\t=1+1", "\r=1+1"])(
    "neutraliza célula iniciada por %j",
    (value) => {
      const expected = value.includes("\r") ? `"'${value}"` : `'${value}`;
      expect(escapeCsvCell(value)).toBe(expected);
    }
  );

  it("mantém texto comum e aspas CSV corretas", () => {
    expect(escapeCsvCell("Dra. Ana")).toBe("Dra. Ana");
    expect(escapeCsvCell('Dra. "Ana", CRM')).toBe('"Dra. ""Ana"", CRM"');
    expect(escapeCsvCell("linha 1\rlinha 2")).toBe('"linha 1\rlinha 2"');
  });
});
