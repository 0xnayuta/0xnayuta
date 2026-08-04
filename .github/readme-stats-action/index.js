// Vendored card generator wrapping @stats-organization/github-readme-stats-core.
// Derived from readme-tools/github-readme-stats-action (MIT).
// The core package is pinned to 2.1.5: its pin query uses the scalar
// `stargazerCount` instead of the `stargazers { totalCount }` connection,
// which repo-scoped GITHUB_TOKENs cannot resolve (the whole repository
// object comes back null and the card renders as "User Repository Not found").
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getInput, info, setFailed, setOutput } from "@actions/core";
import {
  api,
  topLangs,
  pin,
  wakatime,
  gist,
} from "@stats-organization/github-readme-stats-core";

/**
 * Parse options from a query string or JSON object and normalize values.
 * @param {string} value Input value.
 * @returns {Record<string, string>} Parsed options.
 */
const parseOptions = (value) => {
  const options = {};
  if (!value) {
    return options;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    Object.assign(options, JSON.parse(trimmed));
  } else {
    const queryString = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
    for (const [key, val] of new URLSearchParams(queryString).entries()) {
      if (options[key]) {
        options[key] = `${options[key]},${val}`;
      } else {
        options[key] = val;
      }
    }
  }
  for (const key of Object.keys(options)) {
    const val = options[key];
    if (Array.isArray(val)) {
      options[key] = val.join(",");
    } else if (val === null || val === undefined) {
      delete options[key];
    } else {
      options[key] = String(val);
    }
  }
  return options;
};

const CARD_HANDLERS = {
  stats: api,
  "top-langs": topLangs,
  pin,
  wakatime,
  gist,
};

const run = async () => {
  const card = getInput("card", { required: true }).toLowerCase();
  const options = parseOptions(getInput("options"));
  const outputPathInput = getInput("path");
  const token = process.env.PAT_1 || "";

  if (!options.username && process.env.GITHUB_REPOSITORY_OWNER) {
    options.username = process.env.GITHUB_REPOSITORY_OWNER;
  }
  if (!CARD_HANDLERS[card]) {
    throw new Error(`Unsupported card type: ${card}`);
  }
  if (card === "pin" && !options.repo) {
    throw new Error("repo is required for the pin card.");
  }
  if (["stats", "top-langs", "wakatime"].includes(card) && !options.username) {
    throw new Error(`username is required for the ${card} card.`);
  }
  if (card === "gist" && !options.id) {
    throw new Error("id is required for the gist card.");
  }

  const result = await CARD_HANDLERS[card](options, token);
  if (typeof result?.status === "string" && result.status.startsWith("error")) {
    throw new Error(
      `Card generation failed while fetching data (${result.status}).`,
    );
  }
  const svg = result?.content;
  if (!svg) {
    throw new Error("Card renderer returned empty output.");
  }

  const outputPath = path.resolve(
    process.cwd(),
    outputPathInput || path.join("profile", `${card}.svg`),
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svg, "utf8");
  info(`Wrote ${outputPath}`);
  setOutput("path", outputPathInput);
};

run().catch((error) => {
  setFailed(error instanceof Error ? error.message : String(error));
});
