import { Command } from "commander";
import { consola } from "consola";
import fs from "node:fs";
import path from "node:path";

import { EXTENSION_MAP } from "./const";
import { sleep, rootDir } from "./utils";

const outputPath = path.join(rootDir, "output");

const OPENSEA_BASE_URL =
  "https://api.opensea.io/api/v2/chain/ethereum/contract";

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

      consola.start("Start fetching NFTs meta from Opensea");

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
      `${OPENSEA_BASE_URL}/${contractAddress}/nfts/${offset}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "8df878c298854b3fa82f5a2c711a189c",
        },
      }
    );
    const json = await response.json();

    if (!json?.nft?.display_image_url) {
      consola.warn(
        `Image display_image_url of token #${offset} is not available`
      );
    }

    // fetch NFT image
    const imageResponse = await fetch(
      json.nft.display_image_url.replace("w=500", "w=1024")
    );
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
