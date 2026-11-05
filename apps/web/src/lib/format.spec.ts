import { formatXaf } from "./format";

describe("formatXaf", () => {
  it("formate un montant en FCFA avec séparateur de milliers (fr)", () => {
    expect(formatXaf(15000, "fr")).toBe("15 000 FCFA");
  });

  it("formate un montant sans décimales", () => {
    expect(formatXaf(500, "fr")).toBe("500 FCFA");
  });

  it("formate en anglais", () => {
    expect(formatXaf(15000, "en")).toBe("15,000 FCFA");
  });
});
