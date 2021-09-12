#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as pug from 'pug';
import parseChangeLog from 'changelog-parser';

const templatePath = `${__dirname}/changelog.pug`;

type ChangeLog = {
  title: string;
  versions: {
    version: string;
    title: string;
    date: string;
    body: string;
    parsed: Record<string, string[]>;
  }[];
};

const order = ['New', 'Changed', 'Improved', 'Fixed', 'Removed', 'Security'];
const saveIntermediateFiles = false;

async function main() {
  const text = fs
    .readFileSync(`${__dirname}/../CHANGELOG.md`, 'utf-8')
    .replace(/^(Added|New|Changed|Improved|Fixed|Removed|Security):$/gm, '### $1')
    .replace(/^(- .*(\n {2}.+?)+\n)/gm, s => s.replace(/\n {2}/g, ' '));

  if (saveIntermediateFiles) fs.writeFileSync('changelog-out.md', text);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await parseChangeLog({ text } as any)) as ChangeLog;
  json.versions.forEach(version => {
    version.parsed = Object.fromEntries(
      Object.entries(version.parsed)
        .filter(([key]) => key !== '_')
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    );
  });
  if (saveIntermediateFiles) fs.writeFileSync('changelog.json', JSON.stringify(json, null, 2));

  const html = pug.renderFile(templatePath, {
    title: 'What’s New in P5 Server',
    versions: json.versions
  });

  const outfile = `${__dirname}/../resources/changelog.html`;
  fs.writeFileSync(outfile, html);
  console.log(`Wrote ${outfile}`);

  while (process.env.NODE_ENV_WAIT) {
    console.log('Waiting for changes...');
    await new Promise(resolve => setTimeout(resolve, 3600 * 1000));
  }
}

main();
