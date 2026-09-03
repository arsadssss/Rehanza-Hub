declare module 'papaparse' {
  export interface ParseConfig<T = any> {
    delimiter?: string;
    newline?: string;
    quoteChar?: string;
    escapeChar?: string;
    header?: boolean;
    transformHeader?: (header: string, index?: number) => string;
    dynamicTyping?: boolean | Record<string, boolean>;
    preview?: number;
    comments?: boolean | string;
    step?: (results: ParseResult<T>, parser: any) => void;
    complete?: (results: ParseResult<T>, file?: any) => void;
    error?: (error: any, file?: any) => void;
    download?: boolean;
    downloadRequestHeaders?: Record<string, string>;
    skipEmptyLines?: boolean | 'greedy';
    chunk?: (results: ParseResult<T>, parser: any) => void;
    fastMode?: boolean;
    beforeFirstChunk?: (chunk: string) => string | void;
    withCredentials?: boolean;
    transform?: (value: string, field: string | number) => any;
    delimitersToGuess?: string[];
  }

  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row: number;
    index: number;
  }

  export interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    fields?: string[];
    truncated: boolean;
    cursor: number;
  }

  export interface ParseResult<T = any> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export function parse<T = any>(input: string | any, config?: ParseConfig<T>): ParseResult<T>;

  const papa: {
    parse: typeof parse;
  };
  export default papa;
}
