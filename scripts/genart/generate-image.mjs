#!/usr/bin/env node
/**
 * Minimal CLI around the Gemini image-generation model ("Nano Banana",
 * gemini-2.5-flash-image). Reads GEMINI_API_KEY from the environment — run
 * with `node --env-file=.env.local` so .env.local is picked up.
 *
 * Usage:
 *   node --env-file=.env.local scripts/genart/generate-image.mjs \
 *     --prompt "..." \
 *     --out concepts/characters/2026-09-17/red-brawler-ref.png \
 *     [--ref path/to/reference1.png] [--ref path/to/reference2.png]
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';

const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function parseArgs(argv) {
  const args = { refs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prompt') args.prompt = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--ref') args.refs.push(argv[++i]);
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.prompt || !args.out) {
    throw new Error('Usage: --prompt "<text>" --out <file.png> [--ref <file>]...');
  }
  return args;
}

function mimeTypeFor(path) {
  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Run with: node --env-file=.env.local ...');
  }

  const { prompt, out, refs } = parseArgs(process.argv.slice(2));

  const parts = [];
  for (const refPath of refs) {
    const bytes = await readFile(refPath);
    parts.push({
      inlineData: {
        mimeType: mimeTypeFor(refPath),
        data: bytes.toString('base64')
      }
    });
  }
  parts.push({ text: prompt });

  console.log(`[genart] calling ${MODEL} with ${refs.length} reference image(s)...`);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({ contents: [{ parts }] })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const candidateParts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = candidateParts.find((p) => p.inlineData?.data);

  if (!imagePart) {
    const textPart = candidateParts.find((p) => p.text)?.text;
    throw new Error(
      `No image returned. Model said: ${textPart ?? JSON.stringify(json).slice(0, 500)}`
    );
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(imagePart.inlineData.data, 'base64'));
  console.log(`[genart] saved -> ${out}`);
}

main().catch((err) => {
  console.error('[genart] failed:', err.message);
  process.exit(1);
});
