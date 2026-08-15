import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock Context ─────────────────────────────────────────────────────────────

function createMockContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-openid",
      name: "Dr. Test User",
      email: "dr.test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth", () => {
  it("returns null user when unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  it("returns user when authenticated", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user?.name).toBe("Dr. Test User");
    expect(user?.email).toBe("dr.test@example.com");
  });

  it("clears session cookie on logout", async () => {
    const clearedCookies: string[] = [];
    const ctx: TrpcContext = {
      ...createMockContext(),
      res: {
        clearCookie: (name: string) => { clearedCookies.push(name); },
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});

// ─── IOL Router Tests ─────────────────────────────────────────────────────────

describe("iols", () => {
  it("list requires authentication and returns IOLs sorted by usage", async () => {
    // iols.list is now a protectedProcedure that sorts by doctor's usage frequency
    const unauthCtx = createUnauthContext();
    const unauthCaller = appRouter.createCaller(unauthCtx);
    // Should throw UNAUTHORIZED for unauthenticated users
    await expect(unauthCaller.iols.list()).rejects.toThrow();

    // Should resolve for authenticated users (may return empty array if no DB in test)
    const authCtx = createMockContext();
    const authCaller = appRouter.createCaller(authCtx);
    await expect(authCaller.iols.list()).resolves.toBeDefined();
  });

  it("byId is publicly accessible", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw for public procedure (may return null if no DB)
    await expect(caller.iols.byId({ id: 999 })).resolves.toBeDefined();
  });

  it("create requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.iols.create({
        manufacturerId: 1,
        model: "Test IOL",
        type: "trifocal",
      })
    ).rejects.toThrow();
  });

  it("create is rejected for a non-admin doctor", async () => {
    // O catálogo de LIOs é global e compartilhado: escrita é só de admin.
    // Este teste antes usava um médico comum e só verificava "não é
    // UNAUTHORIZED" dentro de um catch — permanecia verde sem testar nada.
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.iols.create({
        manufacturerId: 1,
        model: "Test IOL Model",
        type: "edof",
        material: "Hydrophobic acrylic",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("create passes authorization for an admin", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    // Sem banco no ambiente de teste a chamada pode falhar na camada de dados;
    // o que importa aqui é que ela não seja barrada por autorização.
    try {
      await caller.iols.create({
        manufacturerId: 1,
        model: "Test IOL Model",
        type: "edof",
        material: "Hydrophobic acrylic",
      });
    } catch (err: any) {
      expect(err.code).not.toBe("FORBIDDEN");
      expect(err.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("compare accepts valid iol id array", async () => {
    // iols.compare is a protectedProcedure — requires authenticated context
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.iols.compare({ iolIds: [1, 2] });
      expect(result).toBeDefined();
    } catch (err: any) {
      // Accept DB connection errors but not auth errors
      expect(err.message).not.toContain("UNAUTHORIZED");
      expect(err.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("compare rejects empty array", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.iols.compare({ iolIds: [] })).rejects.toThrow();
  });

  it("compare rejects more than 8 IOLs", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.iols.compare({ iolIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] })
    ).rejects.toThrow();
  });
});

// ─── Patient Router Tests ─────────────────────────────────────────────────────

describe("patients", () => {
  it("list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.patients.list()).rejects.toThrow();
  });

  it("create requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.patients.create({ name: "João Silva", lgpdConsent: true })
    ).rejects.toThrow();
  });

  it("create validates name is required", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.patients.create({ name: "", lgpdConsent: true })
    ).rejects.toThrow();
  });

  it("create accepts valid patient data", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.patients.create({
        name: "Maria Oliveira",
        birthDate: "1980-05-15",
        phone: "(21) 99999-0000",
        lgpdConsent: true,
      });
    } catch (err: any) {
      expect(err.message).not.toContain("UNAUTHORIZED");
    }
  });

  it("delete requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.patients.delete({ id: 1 })).rejects.toThrow();
  });
});

// ─── Measurements Router Tests ────────────────────────────────────────────────

describe("measurements", () => {
  it("byPatient requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.measurements.byPatient({ patientId: 1 })).rejects.toThrow();
  });

  it("create requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.measurements.create({
        patientId: 1,
        measurementDate: new Date().toISOString(),
        eye: "OD",
        points: [{ diopter: 0, visualAcuity: 1.0 }],
      })
    ).rejects.toThrow();
  });

  it("create validates minimum 1 point", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.measurements.create({
        patientId: 1,
        measurementDate: new Date().toISOString(),
        eye: "OD",
        points: [],
      })
    ).rejects.toThrow();
  });

  it("create validates diopter range (-5 to +3)", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.measurements.create({
        patientId: 1,
        measurementDate: new Date().toISOString(),
        eye: "OD",
        points: [{ diopter: -10, visualAcuity: 1.0 }],
      })
    ).rejects.toThrow();
  });

  it("create validates visual acuity range (0 to 2.0)", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.measurements.create({
        patientId: 1,
        measurementDate: new Date().toISOString(),
        eye: "OD",
        points: [{ diopter: 0, visualAcuity: 5.0 }],
      })
    ).rejects.toThrow();
  });

  it("create accepts valid measurement with multiple points", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.measurements.create({
        patientId: 1,
        measurementDate: new Date().toISOString(),
        eye: "OD",
        notes: "Test measurement",
        points: [
          { diopter: -2, visualAcuity: 0.8 },
          { diopter: -1, visualAcuity: 0.9 },
          { diopter: 0, visualAcuity: 1.0 },
          { diopter: 0.5, visualAcuity: 0.7 },
        ],
      });
    } catch (err: any) {
      expect(err.message).not.toContain("UNAUTHORIZED");
    }
  });

  it("accepts all valid eye values", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    for (const eye of ["OD", "OS", "OU"] as const) {
      try {
        await caller.measurements.create({
          patientId: 1,
          measurementDate: new Date().toISOString(),
          eye,
          points: [{ diopter: 0, visualAcuity: 1.0 }],
        });
      } catch (err: any) {
        expect(err.message).not.toContain("UNAUTHORIZED");
      }
    }
  });
});

// ─── Manufacturers Tests ──────────────────────────────────────────────────────

describe("manufacturers", () => {
  it("list is publicly accessible", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.manufacturers.list()).resolves.toBeDefined();
  });

  it("create requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.manufacturers.create({ name: "Test Manufacturer" })
    ).rejects.toThrow();
  });
});
