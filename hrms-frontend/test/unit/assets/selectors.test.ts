import {
  emptyAssetDraft,
  WARRANTY_EXPIRING_SOON_DAYS,
} from "@/modules/assets/constants";
import {
  assetDraftToCreateBody,
  assetDraftToUpdateBody,
  countAssetsByStatus,
  createDefaultDirectoryQuery,
  emptyCategoryStatusHint,
  filterAssets,
  findUniqueAssetByStickerQuery,
  isCategoryLowStock,
  readAssetStickerQueryParam,
  selectCategoryInventory,
  toAssetsListParams,
  validateAssetDraft,
} from "@/modules/assets/selectors";
import type { AssetDraft, AssetRecord } from "@/modules/assets/types";

function draft(overrides: Partial<AssetDraft> = {}): AssetDraft {
  return { ...emptyAssetDraft(), categoryId: "cat-laptop", ...overrides };
}

describe("validateAssetDraft serial number", () => {
  it("requires serial for Laptop and Mobile", () => {
    expect(validateAssetDraft(draft(), "Laptop").serialNumber).toMatch(
      /required for Laptop/,
    );
    expect(validateAssetDraft(draft({ serialNumber: "  " }), "Mobile").serialNumber)
      .toMatch(/required for Mobile/);
    expect(
      validateAssetDraft(draft({ serialNumber: "SN-1" }), "Laptop").serialNumber,
    ).toBeUndefined();
  });

  it("keeps serial optional for other categories", () => {
    for (const category of [
      "Keyboard",
      "Mouse",
      "Monitor",
      "Access Card",
      "Docking Station",
      undefined,
      "",
    ]) {
      expect(validateAssetDraft(draft(), category).serialNumber).toBeUndefined();
    }
  });

  it("still rejects warranty expiry before purchase date", () => {
    const errors = validateAssetDraft(
      draft({
        serialNumber: "SN-1",
        purchaseDate: "2026-09-10",
        warrantyExpiry: "2026-09-01",
      }),
      "Laptop",
    );
    expect(errors.warrantyExpiry).toMatch(/on or after the purchase date/);
  });
});

describe("asset draft bodies", () => {
  it("omits blank serial on create and includes it when present", () => {
    expect(assetDraftToCreateBody(draft()).serialNumber).toBeUndefined();
    expect(
      assetDraftToCreateBody(draft({ serialNumber: " SN-9 " })).serialNumber,
    ).toBe("SN-9");
  });

  it("omits purchaseDate from PATCH when the stored date is locked", () => {
    const body = assetDraftToUpdateBody(
      draft({ purchaseDate: "2026-09-10", serialNumber: "SN-1" }),
      { lockPurchaseDate: true },
    );
    expect(body.purchaseDate).toBeUndefined();
    expect(body.serialNumber).toBe("SN-1");

    const unlocked = assetDraftToUpdateBody(
      draft({ purchaseDate: "2026-09-10" }),
    );
    expect(unlocked.purchaseDate).toBe("2026-09-10");
  });

  it("round-trips optional warranty plan type and number on create and patch", () => {
    expect(assetDraftToCreateBody(draft()).warrantyPlanType).toBeUndefined();
    expect(assetDraftToCreateBody(draft()).warrantyPlan).toBeUndefined();
    expect(
      assetDraftToCreateBody(
        draft({ warrantyPlan: " leftover " }),
      ).warrantyPlan,
    ).toBeUndefined();
    expect(
      assetDraftToCreateBody(
        draft({ warrantyPlanType: "AppleCare / AppleCare+" }),
      ).warrantyPlanType,
    ).toBe("AppleCare / AppleCare+");
    expect(
      assetDraftToCreateBody(
        draft({ warrantyPlanType: "AppleCare / AppleCare+" }),
      ).warrantyPlan,
    ).toBeUndefined();
    expect(
      assetDraftToCreateBody(
        draft({
          warrantyPlanType: "AppleCare / AppleCare+",
          warrantyPlan: " AC-19 ",
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        warrantyPlanType: "AppleCare / AppleCare+",
        warrantyPlan: "AC-19",
      }),
    );
    expect(assetDraftToUpdateBody(draft()).warrantyPlanType).toBeNull();
    expect(assetDraftToUpdateBody(draft()).warrantyPlan).toBeNull();
    expect(
      assetDraftToUpdateBody(
        draft({
          warrantyPlanType: "Store / retailer protection",
          warrantyPlan: "4412",
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        warrantyPlanType: "Store / retailer protection",
        warrantyPlan: "4412",
      }),
    );
    expect(
      assetDraftToUpdateBody(
        draft({ warrantyPlanType: "", warrantyPlan: "stale" }),
      ).warrantyPlan,
    ).toBeNull();
  });
});

function localIsoDate(daysFromToday = 0): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    systemAssetId: "sys-1",
    assetId: "COG-LAP-0001",
    categoryId: "cat-1",
    categoryName: "Laptop",
    serialNumber: "SN-1",
    model: "X1",
    osPlatform: "Windows",
    condition: "Good",
    specifications: null,
    purchaseDate: null,
    warrantyExpiry: null,
    warrantyPlanType: null,
    warrantyPlan: null,
    hasPurchaseReceipt: false,
    purchaseReceiptFileName: null,
    status: "In Stock",
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    openAllocationId: null,
    ...overrides,
  };
}

describe("directory search", () => {
  it("matches Asset ID, employee name, category, or model", () => {
    const assignedLaptop = asset({
      systemAssetId: "lap-1",
      assetId: "COG-LAP-0001",
      categoryName: "Laptop",
      model: "MacBook Air",
      assignedEmployeeName: "John Doe",
    });
    const keyboard = asset({
      systemAssetId: "key-1",
      assetId: "COG-KEY-0001",
      categoryName: "Keyboard",
      model: "Logi",
      assignedEmployeeName: null,
    });
    const rows = [assignedLaptop, keyboard];
    for (const search of ["COG-LAP-0001", "john", "laptop", "macbook"]) {
      expect(
        filterAssets(rows, {
          ...createDefaultDirectoryQuery(),
          search,
        }).map((row) => row.systemAssetId),
      ).toEqual(["lap-1"]);
    }
  });
});

describe("warranty expiring soon filter", () => {
  it("sends warrantyExpiringSoon on the list API params", () => {
    expect(toAssetsListParams(createDefaultDirectoryQuery())).not.toHaveProperty(
      "warrantyExpiringSoon",
    );
    expect(
      toAssetsListParams({
        ...createDefaultDirectoryQuery(),
        warrantyExpiringSoon: true,
      }).warrantyExpiringSoon,
    ).toBe(true);
  });

  it("keeps warranties in the next 30 days and drops expired or far-future", () => {
    const soon = asset({
      systemAssetId: "soon",
      assetId: "COG-LAP-0010",
      warrantyExpiry: localIsoDate(10),
    });
    const far = asset({
      systemAssetId: "far",
      assetId: "COG-LAP-0090",
      warrantyExpiry: localIsoDate(90),
    });
    const expired = asset({
      systemAssetId: "expired",
      assetId: "COG-LAP-0000",
      warrantyExpiry: localIsoDate(-5),
    });
    const missing = asset({
      systemAssetId: "missing",
      assetId: "COG-LAP-0002",
      warrantyExpiry: null,
    });
    const onWindowEnd = asset({
      systemAssetId: "end",
      assetId: "COG-LAP-0030",
      warrantyExpiry: localIsoDate(WARRANTY_EXPIRING_SOON_DAYS),
    });
    const query = {
      ...createDefaultDirectoryQuery(),
      warrantyExpiringSoon: true,
    };
    const ids = filterAssets(
      [soon, far, expired, missing, onWindowEnd],
      query,
    ).map((row) => row.systemAssetId);
    expect(ids).toEqual(["soon", "end"]);
  });
});

describe("warranty expired filter", () => {
  it("sends warrantyExpired on the list API params and not soon", () => {
    expect(toAssetsListParams(createDefaultDirectoryQuery())).not.toHaveProperty(
      "warrantyExpired",
    );
    expect(
      toAssetsListParams({
        ...createDefaultDirectoryQuery(),
        warrantyExpired: true,
      }).warrantyExpired,
    ).toBe(true);
    expect(
      toAssetsListParams({
        ...createDefaultDirectoryQuery(),
        warrantyExpired: true,
        warrantyExpiringSoon: true,
      }),
    ).toEqual(
      expect.objectContaining({
        warrantyExpired: true,
      }),
    );
    expect(
      toAssetsListParams({
        ...createDefaultDirectoryQuery(),
        warrantyExpired: true,
        warrantyExpiringSoon: true,
      }),
    ).not.toHaveProperty("warrantyExpiringSoon");
  });

  it("includes dates before today and excludes today through the soon window", () => {
    const expired = asset({
      systemAssetId: "expired",
      assetId: "COG-LAP-0000",
      warrantyExpiry: localIsoDate(-5),
    });
    const yesterday = asset({
      systemAssetId: "yesterday",
      assetId: "COG-LAP-0003",
      warrantyExpiry: localIsoDate(-1),
    });
    const today = asset({
      systemAssetId: "today",
      assetId: "COG-LAP-0004",
      warrantyExpiry: localIsoDate(0),
    });
    const soon = asset({
      systemAssetId: "soon",
      assetId: "COG-LAP-0010",
      warrantyExpiry: localIsoDate(10),
    });
    const missing = asset({
      systemAssetId: "missing",
      assetId: "COG-LAP-0002",
      warrantyExpiry: null,
    });
    const ids = filterAssets(
      [expired, yesterday, today, soon, missing],
      { ...createDefaultDirectoryQuery(), warrantyExpired: true },
    ).map((row) => row.systemAssetId);
    expect(ids).toEqual(["expired", "yesterday"]);
  });

  it("keeps the soon filter excluding already-expired dates", () => {
    const expired = asset({
      systemAssetId: "expired",
      warrantyExpiry: localIsoDate(-1),
    });
    const soon = asset({
      systemAssetId: "soon",
      warrantyExpiry: localIsoDate(5),
    });
    const ids = filterAssets(
      [expired, soon],
      { ...createDefaultDirectoryQuery(), warrantyExpiringSoon: true },
    ).map((row) => row.systemAssetId);
    expect(ids).toEqual(["soon"]);
  });
});

describe("sticker QR query helpers", () => {
  it("reads and trims q from the URL search string", () => {
    expect(readAssetStickerQueryParam("?q=COG-LAP-0001")).toBe("COG-LAP-0001");
    expect(readAssetStickerQueryParam("q=%20cog-lap-0001%20")).toBe(
      "cog-lap-0001",
    );
    expect(readAssetStickerQueryParam("?sku=full")).toBe("");
  });

  it("returns the unique Asset ID match, case-insensitive", () => {
    const laptop = asset({ systemAssetId: "sys-lap", assetId: "COG-LAP-0001" });
    const keyboard = asset({
      systemAssetId: "sys-key",
      assetId: "COG-KEY-0001",
    });
    expect(
      findUniqueAssetByStickerQuery([laptop, keyboard], "  cog-lap-0001  ")
        ?.systemAssetId,
    ).toBe("sys-lap");
    expect(
      findUniqueAssetByStickerQuery([laptop, keyboard], "COG"),
    ).toBeNull();
    expect(findUniqueAssetByStickerQuery([laptop, laptop], "COG-LAP-0001")).toBeNull();
  });
});

describe("countAssetsByStatus", () => {
  it("counts every status after other filters, ignoring the selected status", () => {
    const rows = [
      asset({ systemAssetId: "s1", status: "In Stock" }),
      asset({ systemAssetId: "s2", status: "Assigned" }),
      asset({ systemAssetId: "s3", status: "Assigned" }),
      asset({
        systemAssetId: "s4",
        status: "Under Repair",
        categoryId: "cat-2",
      }),
      asset({ systemAssetId: "s5", status: "Decommissioned" }),
    ];
    const query = {
      ...createDefaultDirectoryQuery(),
      categoryId: "cat-1",
      categoryFilterEngaged: true,
      status: "Assigned" as const,
      statusFilterEngaged: true,
    };
    expect(countAssetsByStatus(rows, query)).toEqual({
      all: 4,
      "In Stock": 1,
      Assigned: 2,
      "Under Repair": 0,
      Decommissioned: 1,
      Lost: 0,
    });
  });
});

describe("selectCategoryInventory", () => {
  it("counts each status per category and flags low spare stock", () => {
    const categories = [
      { categoryId: "cat-laptop", categoryName: "Laptop" },
      { categoryId: "cat-card", categoryName: "Access Card" },
    ];
    const rows = [
      asset({
        systemAssetId: "s1",
        categoryId: "cat-laptop",
        status: "In Stock",
      }),
      asset({
        systemAssetId: "s2",
        categoryId: "cat-laptop",
        status: "Assigned",
      }),
      asset({
        systemAssetId: "s3",
        categoryId: "cat-laptop",
        status: "Assigned",
      }),
      asset({
        systemAssetId: "s4",
        categoryId: "cat-laptop",
        status: "Assigned",
      }),
      asset({
        systemAssetId: "s5",
        categoryId: "cat-laptop",
        status: "Assigned",
      }),
      asset({
        systemAssetId: "s6",
        categoryId: "cat-card",
        categoryName: "Access Card",
        status: "In Stock",
      }),
    ];
    const [laptop, card] = selectCategoryInventory(categories, rows);
    expect(laptop).toEqual(
      expect.objectContaining({
        categoryName: "Laptop",
        total: 5,
        counts: {
          "In Stock": 1,
          Assigned: 4,
          "Under Repair": 0,
          Decommissioned: 0,
          Lost: 0,
        },
        lowStock: true,
      }),
    );
    expect(card).toEqual(
      expect.objectContaining({
        categoryName: "Access Card",
        total: 1,
        lowStock: false,
      }),
    );
    expect(
      isCategoryLowStock(
        {
          "In Stock": 0,
          Assigned: 2,
          "Under Repair": 0,
          Decommissioned: 0,
          Lost: 0,
        },
        "Mobile",
      ),
    ).toBe(true);
    expect(
      isCategoryLowStock(
        {
          "In Stock": 0,
          Assigned: 2,
          "Under Repair": 0,
          Decommissioned: 0,
          Lost: 0,
        },
        "Keyboard",
      ),
    ).toBe(false);
    expect(emptyCategoryStatusHint("Keyboard", "Assigned")).toBe(
      "No keyboards assigned",
    );
    expect(emptyCategoryStatusHint("Laptop", "In Stock")).toBe(
      "No laptops in stock",
    );
    expect(emptyCategoryStatusHint("Laptop", "Under Repair")).toBe(
      "No laptops under repair",
    );
    expect(emptyCategoryStatusHint("Access Card", "Decommissioned")).toBe(
      "No access cards decommissioned",
    );
    expect(emptyCategoryStatusHint("Mouse", "Assigned")).toBe(
      "No mice assigned",
    );
  });

  it("lists categories with assets before empty catalog categories", () => {
    const categories = [
      { categoryId: "cat-card", categoryName: "Access Card" },
      { categoryId: "cat-keyboard", categoryName: "Keyboard" },
      { categoryId: "cat-laptop", categoryName: "Laptop" },
    ];
    const rows = [
      asset({
        systemAssetId: "s1",
        categoryId: "cat-laptop",
        status: "In Stock",
      }),
    ];
    expect(
      selectCategoryInventory(categories, rows).map((row) => row.categoryName),
    ).toEqual(["Laptop", "Access Card", "Keyboard"]);
  });
});

describe("toAssetsListParams status", () => {
  it("does not send status so Status tabs can count every bucket", () => {
    expect(
      toAssetsListParams({
        ...createDefaultDirectoryQuery(),
        status: "Assigned",
        statusFilterEngaged: true,
      }),
    ).not.toHaveProperty("status");
  });
});
