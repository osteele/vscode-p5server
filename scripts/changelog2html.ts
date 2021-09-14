#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as pug from 'pug';
import marked from 'marked';
import { HTMLElement, parse } from 'node-html-parser';
import { DateTime } from 'luxon';

const templatePath = `${__dirname}/changelog.pug`;

type ChangeLog = {
  title: string;
  versions: {
    version?: string;
    title: string;
    date?: string;
    body: string;
    parsed: Record<string, string[]>;
  }[];
};

const order = ['New', 'Changed', 'Improved', 'Fixed', 'Removed', 'Security'];
const saveIntermediateFiles = process.env.NODE_ENV === 'development';

function parseChangeLog({ text }: { text: string }): ChangeLog {
  const html = marked(text, { headerIds: false, smartypants: true });
  const htmlRoot = parse(html);
  const title = htmlRoot.querySelector('h1')?.text;
  const sections = findSections('h2', htmlRoot);
  return {
    title,
    versions: sections.map(({ header, body }) => {
      const title = header.text.replace(/^\[(.*)\]$/, '$1');
      let versionCandidate = title,
        version: string | undefined,
        date: string | undefined;
      const m = title.match(/(.+?)(?:\s+-+\s+|\s*[–—]\s*)(.+)/);
      console.info(title, m);
      if (m) {
        versionCandidate = m[1];
        date =
          ['yyyy-LL-dd', 'LL-dd-yyyy', 'LL-dd-yy', 'LL/dd/yyyy', 'LL/dd/yy']
            .map(fmt => DateTime.fromFormat(m[2], fmt))
            .find(Boolean)
            ?.toLocaleString(DateTime.DATE_FULL) || m[2];
      }
      if (versionCandidate.match(/^\d+(\.\d+){0,2}\S*$/)) version = versionCandidate;
      const parsed = collect(
        findSections('h3', parse(body)).flatMap(({ header, body }): [string, string][] => {
          const key = header.text;
          const ul = parse(body).querySelector('ul');
          return ul ? ul.querySelectorAll('> li').map(li => [key, li.innerHTML]) : [];
        })
      );
      return { title, version, date, body: body, parsed };
    })
  };

  function findSections(selector: string, parent: HTMLElement) {
    const headers = parent.querySelectorAll(selector);
    return headers.map((header, i) => {
      const nextHeader = headers[i + 1];
      const body = [];
      for (let elt = header.nextElementSibling; elt && elt !== nextHeader; elt = elt.nextElementSibling) {
        body.push(elt);
      }
      return {
        header,
        body: body.map(node => node.outerHTML).join('\n')
      };
    });
  }

  function collect<K extends string | number | symbol, V>(pairs: [K, V][]): Record<K, V[]> {
    const result: Record<K, V[]> = {} as Record<K, V[]>;
    for (const [key, value] of pairs) {
      if (!result[key]) result[key] = [];
      result[key].push(value);
    }
    return result;
  }
}

async function main() {
  const text = fs
    .readFileSync(`${__dirname}/../CHANGELOG.md`, 'utf-8')
    .replace(/^(Added|New|Changed|Improved|Fixed|Removed|Security):$/gm, '### $1');

  if (saveIntermediateFiles) fs.writeFileSync('./out/changelog-out.md', text);

  const json = parseChangeLog({ text });
  json.versions.forEach(version => {
    version.parsed = Object.fromEntries(
      Object.entries(version.parsed)
        .filter(([key]) => key !== '_')
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    );
  });
  if (saveIntermediateFiles) fs.writeFileSync('./out/changelog.json', JSON.stringify(json, null, 2));

  const html = pug.renderFile(templatePath, {
    title: 'What’s New in P5 Server',
    versions: json.versions
  });

  const outfile = `${__dirname}/../resources/changelog.html`;
  fs.writeFileSync(outfile, html);
  console.log(`Wrote ${outfile}`);

  while (process.env.CHANGE_LOG_WATCH) {
    console.log('Waiting for changes...');
    await new Promise(resolve => setTimeout(resolve, 3600 * 1000));
  }
}

main();
