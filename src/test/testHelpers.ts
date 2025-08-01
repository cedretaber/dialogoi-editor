/**
 * テスト用ヘルパー関数群
 * DialogoiTreeItemのテストデータ作成をサポート
 */
import {
  ContentItem,
  SettingItem,
  SubdirectoryItem,
  CharacterItem,
} from '../models/DialogoiTreeItem.js';

export function createContentItem(partial: Partial<ContentItem>): ContentItem {
  return {
    name: 'test.md',
    type: 'content',
    path: '/test/test.md',
    hash: 'default-hash',
    tags: [],
    references: [],
    comments: 'default-comments.yaml',
    isUntracked: false,
    isMissing: false,
    ...partial,
  };
}

export function createSettingItem(partial: Partial<SettingItem>): SettingItem {
  return {
    name: 'test.md',
    type: 'setting',
    path: '/test/test.md',
    hash: 'default-hash',
    tags: [],
    comments: 'default-comments.yaml',
    isUntracked: false,
    isMissing: false,
    ...partial,
  };
}

export function createSubdirectoryItem(partial: Partial<SubdirectoryItem>): SubdirectoryItem {
  return {
    name: 'test',
    type: 'subdirectory',
    path: '/test/test',
    isUntracked: false,
    isMissing: false,
    ...partial,
  };
}

export function createCharacterItem(partial: Partial<CharacterItem>): CharacterItem {
  return {
    name: 'test.md',
    type: 'setting',
    path: '/test/test.md',
    hash: 'default-hash',
    tags: [],
    comments: 'default-comments.yaml',
    isUntracked: false,
    isMissing: false,
    character: {
      importance: 'main',
      multiple_characters: false,
      display_name: '',
    },
    ...partial,
  };
}
