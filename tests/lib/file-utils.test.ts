jest.mock("expo-file-system", () => {
  const Paths = { cache: "/cache" };
  class Directory {
    uri: string;
    exists = false;
    constructor(parent: string | { uri: string }, name: string) {
      const base = typeof parent === "string" ? parent : parent.uri;
      this.uri = `${base}/${name}`;
    }
    create() {
      this.exists = true;
    }
  }
  class File {
    name: string;
    uri: string;
    constructor(parent: string | { uri: string }, name: string) {
      const base = typeof parent === "string" ? parent : parent.uri;
      this.name = name;
      this.uri = `${base}/${name}`;
    }
  }
  return { Directory, File, Paths };
});

import { cacheFileDestination } from "@/lib/file-utils";

describe("cacheFileDestination", () => {
  it("neutralizes URL-significant characters that break native file URI parsing", () => {
    const destination = cacheFileDestination("file-id", "HOW TO BECOME AN ELITE PLAYER 99%#.pdf");

    expect(destination.name).toBe("HOW TO BECOME AN ELITE PLAYER 99__.pdf");
    expect(destination.name).not.toMatch(/[%#]/);
  });

  it("neutralizes characters that are illegal in file names", () => {
    const destination = cacheFileDestination("file-id", 'a/b\\c:d*e?f"g<h>i|j.pdf');

    expect(destination.name).not.toMatch(/[/\\:*?"<>|]/);
  });

  it("neutralizes square brackets and other URI delimiters that crash native path parsing", () => {
    const destination = cacheFileDestination("file-id", "301 [NSFW] Rider [2023].png");

    expect(destination.name).toBe("301 _NSFW_ Rider _2023_.png");
    expect(destination.name).not.toMatch(/[[\]{}^`]/);
  });

  it("preserves spaces, which are valid in file URIs", () => {
    const destination = cacheFileDestination("file-id", "my great file.pdf");

    expect(destination.name).toBe("my great file.pdf");
  });
});
