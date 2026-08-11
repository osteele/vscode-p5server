export function padCenter(label: string, width: number, fill = ' '): string {
  const leftPadWidth = (width - label.length) / 2;
  const leftPad = fill.repeat(Math.max(0, Math.floor(leftPadWidth / fill.length)));
  const rightPadWidth = Math.max(0, width - label.length - leftPad.length);
  const rightPad = fill.repeat(Math.ceil(rightPadWidth / fill.length)).slice(0, rightPadWidth);
  return [leftPad, label, rightPad].join('');
}

export function withConsoleRelayQuery(target: string): string {
  const url = new URL(target);
  url.searchParams.set('send-console-messages', '1');
  return url.toString();
}

export function toZeroBasedPosition(line: number, col = 1): { line: number; col: number } {
  return {
    line: Math.max(0, line - 1),
    col: Math.max(0, col - 1),
  };
}
