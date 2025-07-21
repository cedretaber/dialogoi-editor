import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// カスタムレンダー関数（将来的にProviderが必要になった場合に対応）
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): ReturnType<typeof render> => render(ui, options);

// React Testing Libraryの全ての機能をexport
export * from '@testing-library/react';

// カスタムレンダー関数をrenderとしてexport（既存のrenderを上書き）
export { customRender as render };
