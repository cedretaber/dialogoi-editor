import React, { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * TODO進捗情報の型定義
 */
export interface TodoProgress {
  total: number;
  completed: number;
  percentage: number;
}

/**
 * MarkdownRendererコンポーネントのProps
 */
interface MarkdownRendererProps {
  /** レンダリングするマークダウンテキスト */
  content: string;
  /** CSSクラス名 */
  className?: string;
}

/**
 * TODO進捗を計算する関数
 */
const calculateTodoProgress = (content: string): TodoProgress => {
  const todoRegex = /^[ \t]*[-*+][ \t]+\[([ xX])\]/gm;
  const matches = Array.from(content.matchAll(todoRegex));
  const total = matches.length;
  const completed = matches.filter((match) => match[1].toLowerCase() === 'x').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, percentage };
};

/**
 * MarkdownRendererコンポーネント
 *
 * react-markdownを使用した安全なマークダウンレンダリングを提供します。
 * TODOチェックボックスのインタラクティブ機能と進捗計算も含みます。
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = 'markdown-content',
}) => {
  /**
   * チェックボックスのカスタムレンダラー
   * インタラクティブ機能は無効化し、表示のみを行う
   */
  const renderCheckbox = useCallback((props: React.InputHTMLAttributes<HTMLInputElement>) => {
    const { checked, ...otherProps } = props;

    return <input type="checkbox" checked={checked} disabled={true} readOnly {...otherProps} />;
  }, []);

  /**
   * リストアイテムのカスタムレンダラー
   */
  const renderListItem = useCallback(
    (props: React.LiHTMLAttributes<HTMLLIElement> & { children?: React.ReactNode }) => {
      const { children, className: itemClassName, ...otherProps } = props;

      // チェックボックス付きのリストアイテムかどうかを判定
      const hasCheckbox = React.Children.toArray(children).some(
        (child) => React.isValidElement(child) && child.type === 'input',
      );

      const finalClassName = hasCheckbox
        ? `todo-item ${itemClassName || ''}`.trim()
        : itemClassName;

      return (
        <li className={finalClassName} {...otherProps}>
          {children}
        </li>
      );
    },
    [],
  );

  /**
   * コードブロックのカスタムレンダラー
   */
  const renderCode = useCallback(
    (
      props: React.HTMLAttributes<HTMLElement> & { inline?: boolean; children?: React.ReactNode },
    ) => {
      const { inline, className, children, ...otherProps } = props;

      if (inline) {
        return (
          <code className={className} {...otherProps}>
            {children}
          </code>
        );
      }

      return (
        <pre>
          <code className={className} {...otherProps}>
            {children}
          </code>
        </pre>
      );
    },
    [],
  );

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          input: renderCheckbox,
          li: renderListItem,
          code: renderCode,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

/**
 * TODO進捗を計算するユーティリティ関数（外部から使用可能）
 */
export { calculateTodoProgress };
