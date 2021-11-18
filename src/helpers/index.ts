export function padCenter(label: string, width: number, fill = ' '): string {
  const leftPadWidth = (width - label.length) / 2;
  const leftPad = fill.repeat(Math.max(0, Math.floor(leftPadWidth / fill.length)));
  const rightPadWidth = Math.max(0, width - label.length - leftPad.length);
  const rightPad = fill.repeat(Math.ceil(rightPadWidth / fill.length)).slice(0, rightPadWidth);
  return [leftPad, label, rightPad].join('');
}
