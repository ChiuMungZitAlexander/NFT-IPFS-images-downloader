import { Command } from "commander";
import { consola } from "consola";
import fs from "node:fs";
import path from "node:path";

import { EXTENSION_MAP } from "./const";
import { sleep, rootDir } from "./utils";

const outputPath = path.join(rootDir, "output");

const TOKEN = `Token 6d3b85e2e7d3679c55dedc0f2b21ef2a72018061`;

const BASE_URL = "https://api.deepnftvalue.com/v1/tokens";

const program = new Command();

program
  .requiredOption("-s --slug <string>", "collection deep nft slug")
  .requiredOption(
    "-t --total-supply <number>",
    "the total supply of the collection"
  )
  .action(
    async ({ slug, totalSupply }: { slug: string; totalSupply: number }) => {
      // create dir if it doesn't exist
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      // define supported extensions

      let offset = 0;

      consola.start("Start fetching NFTs meta from deepnftvalue");

      do {
        await fetchAndSave(slug, offset);

        offset += 1;
      } while (offset < totalSupply);
    }
  );

program.parse();

async function fetchAndSave(slug: string, offset: number) {
  // skip fetching if file with token id already exists
  const files = fs.readdirSync(outputPath);
  if (files.some((file) => path.parse(file).name === String(offset))) {
    consola.log(`Image of token #${offset} exists, skipped`);
    return;
  }

  try {
    // fetch NFT meta data
    const response = await fetch(`${BASE_URL}/${slug}/${offset}`, {
      headers: new Headers({
        Authorization: TOKEN,
      }),
    });
    const json = await response.json();

    if (typeof json?.image?.src !== "string") {
      consola.log(`Image src is not returned from deepnftvalue API, skipped`);
      return;
    }

    // fetch NFT image
    const imageResponse = await fetch(json.image.src);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    const contentType = imageResponse.headers.get("content-type") ?? "";
    const extension = EXTENSION_MAP[contentType];
    if (!extension) {
      throw new Error("Fetched content is not a supported image type.");
    }

    // save fetched NFT image to local file
    const buffer = await imageResponse.arrayBuffer();
    fs.writeFileSync(
      path.join(outputPath, `${offset}.${extension}`),
      Buffer.from(buffer)
    );
    consola.success(`Saved images token #${offset} as ${offset}.${extension}`);

    // sleep 500ms to avoid reaching rate limit
    await sleep(500);
  } catch (error) {
    consola.error(error);
  }
}
