import path from "node:path";

export const sleep = (ms = 500) =>
  new Promise((res) =>
    setTimeout(() => {
      res(null);
    }, ms)
  );

export const rootDir = path.resolve(__dirname, "../");
