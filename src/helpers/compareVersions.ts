export const enum VersionChange {
  noChange,
  noPreviousVersion,
  major,
  minor,
  patch,
  preRelease,
  build,
}

const versionDiscrimators: [RegExp, VersionChange][] = [
  [/^\d+/, VersionChange.major],
  [/^\d+\.\d+/, VersionChange.minor],
  [/^\d+\.\d+.\d+/, VersionChange.patch],
  [/^\d+\.\d+.\d+[^+]+/, VersionChange.preRelease],
  [/^\d+\.\d+.\d+-.+\+/, VersionChange.build],
];

export function compareVersions(currentVersion: string, previousVersion: string | null | undefined): VersionChange {
  if (!previousVersion) return VersionChange.noPreviousVersion;
  if (previousVersion === currentVersion) return VersionChange.noChange;
  for (const [matcher, component] of versionDiscrimators) {
    if (previousVersion.match(matcher)?.[0] !== currentVersion.match(matcher)?.[0]) {
      return component;
    }
  }
  return VersionChange.build;
}
