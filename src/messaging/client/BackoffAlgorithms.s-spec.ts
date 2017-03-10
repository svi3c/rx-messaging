import { exponential, linear, random } from "./BackoffAlgorithms";

describe("BackoffAlgorithms", () => {

  describe("linear", () => {

    it("should generate correct values", () => {
      let iterator = linear({ from: 0, to: 100, factor: 20 })();

      expect(iterator.next().value).toEqual(0);
      expect(iterator.next().value).toEqual(20);
      expect(iterator.next().value).toEqual(40);
      expect(iterator.next().value).toEqual(60);
      expect(iterator.next().value).toEqual(80);
      expect(iterator.next().value).toEqual(100);
      expect(iterator.next().value).toEqual(100);
      expect(iterator.next().value).toEqual(100);
    });

    it("should have sensible defaults", () => {
      let iterator = linear()();

      expect(iterator.next().value).toEqual(0);
      expect(iterator.next().value).toEqual(500);
      expect(iterator.next().value).toEqual(1000);
      expect(iterator.next().value).toEqual(1500);
      expect(iterator.next().value).toEqual(2000);
      expect(iterator.next().value).toEqual(2500);
      expect(iterator.next().value).toEqual(3000);
      expect(iterator.next().value).toEqual(3500);
      expect(iterator.next().value).toEqual(4000);
      expect(iterator.next().value).toEqual(4500);
      expect(iterator.next().value).toEqual(5000);
      expect(iterator.next().value).toEqual(5000);
      expect(iterator.next().value).toEqual(5000);
    });

  });

  describe("exponential", () => {

    it("should generate correct values", () => {
      let iterator = exponential({ from: 1, to: 32, factor: 1, base: 2 })();

      expect(iterator.next().value).toEqual(1);
      expect(iterator.next().value).toEqual(2);
      expect(iterator.next().value).toEqual(4);
      expect(iterator.next().value).toEqual(8);
      expect(iterator.next().value).toEqual(16);
      expect(iterator.next().value).toEqual(32);
      expect(iterator.next().value).toEqual(32);
      expect(iterator.next().value).toEqual(32);
    });

    it("should have sensible defaults", () => {
      let iterator = exponential()();

      expect(iterator.next().value).toEqual(1);
      expect(iterator.next().value).toEqual(2);
      expect(iterator.next().value).toEqual(4);
      expect(iterator.next().value).toEqual(8);
      expect(iterator.next().value).toEqual(16);
      expect(iterator.next().value).toEqual(32);
      expect(iterator.next().value).toEqual(64);
      expect(iterator.next().value).toEqual(128);
      expect(iterator.next().value).toEqual(256);
      expect(iterator.next().value).toEqual(512);
      expect(iterator.next().value).toEqual(1024);
      expect(iterator.next().value).toEqual(2048);
      expect(iterator.next().value).toEqual(4096);
      expect(iterator.next().value).toEqual(5000);
      expect(iterator.next().value).toEqual(5000);
      expect(iterator.next().value).toEqual(5000);
    });

  });

  describe("exponential", () => {

    function isBetween(val: number, lower: number, upper: number) {
      return val >= lower && val <= upper;
    }

    it("should generate correct values", () => {
      let iterator = random({ from: 0, to: 2 })();

      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 2)).toBeTruthy();
    });

    it("should have sensible defaults", () => {
      let iterator = random()();

      expect(isBetween(iterator.next().value, 0, 5000)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 5000)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 5000)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 5000)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 5000)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 5000)).toBeTruthy();
      expect(isBetween(iterator.next().value, 0, 5000)).toBeTruthy();
    });

  });

});
