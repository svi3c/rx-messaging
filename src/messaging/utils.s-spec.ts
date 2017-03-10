import { isDefined } from "./utils";

describe("utils", () => {

  describe("isDefined()", () => {

    it("should return true if the value is not undefined or null", () => {
      expect(isDefined(undefined)).toBe(false);
      expect(isDefined(null)).toBe(false);
      expect(isDefined(0)).toBe(true);
      expect(isDefined(NaN)).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
      expect(isDefined("")).toBe(true);
    });

  });

});