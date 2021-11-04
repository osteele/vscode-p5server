declare module 'changelog-parser' {
  export type Options = (
    | {
        /**
         * Path to changelog file.
         */
        filePath: string;
      }
    | {
        /**
         * Text of changelog file (you can use this instead of filePath).
         */
        text: string;
      }
  ) & {
    /**
     * Removes the markdown markup from the changelog entries by default.
     * You can change its value to false to keep the markdown.
     */
    removeMarkdown: boolean;
  };

  export type ChangeLog = {
    title: string;
    description: string;
    versions: {
      version: string | null;
      title: string;
      date: string | null;
      body: string;
      parsed: Record<string, string[]>;
    }[];
  };

  /**
   * Change log parser for node.
   */
  declare function parseChangelog(
    options: Partial<Options> | string,
    callback?: (error: string | null, result: ChangeLog) => void
  ): Promise<ChangeLog>;

  export = parseChangelog;
}
