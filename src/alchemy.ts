import { Command } from "commander";
import { consola } from "consola";
import fs from "node:fs";
import path from "node:path";

import { EXTENSION_MAP } from "./const";
import { sleep, rootDir } from "./utils";

const outputPath = path.join(rootDir, "output");

const ALCHEMY_BASE_URL = `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env
  .ALCHEMY_KEY!}/getNFTMetadata`;

const program = new Command();

program
  .requiredOption(
    "-c --contract-address <string>",
    "collection contract address"
  )
  .requiredOption(
    "-s --total-supply <number>",
    "the total supply of the collection"
  )
  .action(
    async ({
      contractAddress,
      totalSupply,
    }: {
      contractAddress: string;
      totalSupply: number;
    }) => {
      // create dir if it doesn't exist
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      let offset = 0;

      consola.start("Start fetching NFTs meta from Alchemy");

      do {
        await fetchAndSave(contractAddress, offset);

        offset += 1;
      } while (offset < totalSupply);
    }
  );

program.parse();

async function fetchAndSave(contractAddress: string, offset: number) {
  // skip fetching if file with token id already exists
  const files = fs.readdirSync(outputPath);
  if (files.some((file) => path.parse(file).name === String(offset))) {
    consola.log(`Image of token #${offset} exists, skipped`);
    return;
  }

  try {
    // fetch NFT meta data
    const response = await fetch(
      `${ALCHEMY_BASE_URL}?contractAddress=${contractAddress}&tokenId=${offset}`
    );
    const json = await response.json();

    if (!json?.image?.cachedUrl) {
      consola.warn(`Image cachedUrl of token #${offset} is not available`);
    }

    // fetch NFT image
    const imageResponse = await fetch(json.image.cachedUrl);
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
