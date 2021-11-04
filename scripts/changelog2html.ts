#!/usr/bin/env ts-node
/// <reference types="./types/changelog-parser" />

import parseChangelog from 'changelog-parser';
import * as fs from 'fs';
import path from 'path';
import * as pug from 'pug';

const templatePath = `${__dirname}/changelog.pug`;

const order = ['New', 'Changed', 'Improved', 'Fixed', 'Removed', 'Security'];
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

  const changelog = await parseChangelog({ text });
  changelog.versions.forEach(version => {
    version.parsed = Object.fromEntries(
      Object.entries(version.parsed)
        .filter(([key]) => key !== '_')
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    );
  });
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
