import { BrowserConsoleEvent } from 'p5-server';
import util = require('util');

export function formatConsoleEventArgs({ args, argStrings }: BrowserConsoleEvent) {
  const argsOrStrings = args.map((arg, i) => argStrings[i] || arg);
  return typeof args[0] === 'string' ? util.format(...argsOrStrings) : argsOrStrings.join(' ');
}
