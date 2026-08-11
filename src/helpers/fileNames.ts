export function validateChildName(value: string): string | undefined {
  const name = value.trim();
  if (!name) {
    return 'Enter a name.';
  }
  if (name === '.' || name === '..' || name.includes('/') || name.includes('\\') || /^[a-z]:/i.test(name)) {
    return 'Enter a name without a directory path.';
  }
  if (name.includes('\0')) {
    return 'The name contains an invalid character.';
  }
  return undefined;
}
