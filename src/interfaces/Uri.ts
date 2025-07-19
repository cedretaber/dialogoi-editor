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
