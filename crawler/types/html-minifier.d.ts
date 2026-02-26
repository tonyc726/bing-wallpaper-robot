declare module 'html-minifier' {
  export interface Options {
    caseSensitive?: boolean;
    keepClosingSlash?: boolean;
    collapseWhitespace?: boolean;
    removeComments?: boolean;
    removeRedundantAttributes?: boolean;
    removeEmptyAttributes?: boolean;
    removeOptionalTags?: boolean;
    removeUnusedCSS?: boolean;
    removeScriptTypeAttributes?: boolean;
    removeStyleLinkTypeAttributes?: boolean;
    minifyCSS?: boolean | string;
    minifyJS?: boolean | string;
    minifyURLs?: boolean | string;
    sortAttributes?: boolean;
    sortClassName?: boolean;
    useShortDoctype?: boolean;
    removeAttributeQuotes?: boolean;
    conservativeCollapse?: boolean;
    preserveLineBreaks?: boolean;
    maxLineLength?: number;
  }

  export function minify(input: string, options?: Options): string;
}
