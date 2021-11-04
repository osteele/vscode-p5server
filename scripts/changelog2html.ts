#!/usr/bin/env ts-node

import { parseChangeLog } from '@osteele/changelog-parser';
import * as fs from 'fs';
import path from 'path';
import * as pug from 'pug';

const templatePath = `${__dirname}/changelog.pug`;

const writeIntermediateFiles = process.env.NODE_ENV === 'development';

async function main() {
  const text = fs
    .readFileSync(`${__dirname}/../CHANGELOG.md`, 'utf-8')
    .replace(
      /^(Added|New|Changed|Improved|Fixed|Removed|Security):$/gm,
      '### $1'
    );

  if (writeIntermediateFiles) {
    fs.writeFileSync('./out/changelog-out.md', text);
  }

  const changelog = parseChangeLog({ text });

  if (writeIntermediateFiles) {
    fs.writeFileSync(
      './out/changelog.json',
      JSON.stringify(changelog, null, 2)
    );
  }

  const html = pug.renderFile(templatePath, {
    title: 'What’s New in P5 Server',
    versions: changelog.versions
  });

  const outfile = `${__dirname}/../resources/changelog.html`;
  fs.writeFileSync(outfile, html);
  console.log(`Wrote ${path.resolve(outfile)}`);

  while (process.env.CHANGE_LOG_WATCH) {
    console.log('Waiting for changes...');
    await new Promise(resolve => setTimeout(resolve, 3600 * 1000));
  }
}

main();
