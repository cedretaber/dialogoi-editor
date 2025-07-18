/**
 * ファイルパスを表すインターフェイス
 * VSCodeのUri型を抽象化
 */
export interface Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;

  toString(): string;
  toJSON(): object;
}

/**
 * Uriファクトリー
 */
export class UriFactory {
  /**
   * ファイルパスからUriを作成
   */
  static file(path: string): Uri {
    // 実際の実装では vscode.Uri.file() を使用
    return {
      scheme: 'file',
      authority: '',
      path: path,
      query: '',
      fragment: '',
      fsPath: path,
      toString: () => `file://${path}`,
      toJSON: () => ({ scheme: 'file', authority: '', path, query: '', fragment: '' }),
    };
  }

  /**
   * 文字列からUriを作成
   */
  static parse(value: string): Uri {
    // 実際の実装では vscode.Uri.parse() を使用
    const url = new URL(value);
    return {
      scheme: url.protocol.slice(0, -1),
      authority: url.hostname,
      path: url.pathname,
      query: url.search.slice(1),
      fragment: url.hash.slice(1),
      fsPath: url.pathname,
      toString: () => value,
      toJSON: () => ({
        scheme: url.protocol.slice(0, -1),
        authority: url.hostname,
        path: url.pathname,
        query: url.search.slice(1),
        fragment: url.hash.slice(1),
      }),
    };
  }
}
