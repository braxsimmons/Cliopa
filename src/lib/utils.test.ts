import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
    it("merges class names and eliminates duplicates", () => {
        expect(cn("a", "b", "a")).toBe("a b");
    });
});
