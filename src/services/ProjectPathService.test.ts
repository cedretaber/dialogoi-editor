import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { ProjectPathService } from './ProjectPathService.js';

describe('ProjectPathService テストスイート', () => {
  let projectPathService: ProjectPathService;
  let mockFileRepository: MockFileRepository;
  let workspaceRootPath: string;
  let testProjectPath: string;

  beforeEach(() => {
    // テスト用サービスコンテナを初期化
    const container = TestServiceContainer.getInstance();
    container.reset();

    // モックファイルサービスを取得
    mockFileRepository = container.getMockFileRepository();

    // サービスを取得
    const dialogoiYamlService = container.getDialogoiYamlService();
    projectPathService = new ProjectPathService(dialogoiYamlService);

    // テスト用のワークスペースとプロジェクトを設定
    workspaceRootPath = '/workspace';
    testProjectPath = path.join(workspaceRootPath, 'novel');

    // テスト用プロジェクト構造を作成
    const dialogoiYamlContent = `title: テスト小説
author: テスト著者
version: 1.0.0
created_at: '2024-01-01T00:00:00Z'`;

    const metaYamlContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /workspace/novel/chapter1.txt
    hash: hash1
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false
  - name: chapter2.txt
    type: content
    path: /workspace/novel/chapter2.txt
    hash: hash2
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false`;

    mockFileRepository.addFile(path.join(testProjectPath, 'dialogoi.yaml'), dialogoiYamlContent);
    mockFileRepository.addFile(path.join(testProjectPath, '.dialogoi-meta.yaml'), metaYamlContent);
    mockFileRepository.addFile(
      path.join(testProjectPath, 'chapter1.txt'),
      'これはテスト章です。\n2行目の内容。\n3行目の内容。',
    );
    mockFileRepository.addFile(path.join(testProjectPath, 'chapter2.txt'), '別の章の内容です。');
  });

  afterEach(() => {
    // テスト用サービスコンテナをリセット
    TestServiceContainer.getInstance().reset();
  });

  describe('getRelativePathFromProject', () => {
    it('プロジェクト内ファイルの相対パス変換が正常に動作する', async () => {
      // プロジェクト内ファイルの絶対パス
      const absoluteFilePath = path.join(testProjectPath, 'chapter1.txt');

      const result = await projectPathService.getRelativePathFromProject(absoluteFilePath);
      assert.ok(result !== null);
      assert.strictEqual(result.projectRoot, testProjectPath);
      assert.strictEqual(result.relativePath, 'chapter1.txt');
    });

    it('プロジェクト外ファイルの場合はnullが返される', async () => {
      // プロジェクト外ディレクトリのファイルパス（存在するファイルを作成）
      const outsideFilePath = '/some/other/path/test.txt';
      mockFileRepository.addFile(outsideFilePath, 'test content');

      const result = await projectPathService.getRelativePathFromProject(outsideFilePath);
      assert.strictEqual(result, null);
    });

    it('上位ディレクトリを参照するパスは無効として扱われる', async () => {
      // プロジェクトルートの上位ディレクトリのファイル
      const upperFilePath = path.join(workspaceRootPath, 'outside.txt');
      mockFileRepository.addFile(upperFilePath, 'outside content');

      // 別のプロジェクトを作成してそこにdialogoi.yamlを置く
      const anotherProjectPath = path.join(workspaceRootPath, 'another-project');
      mockFileRepository.addFile(
        path.join(anotherProjectPath, 'dialogoi.yaml'),
        'title: Another Project',
      );

      // 上位ディレクトリのファイルはプロジェクト外として扱われる
      const result = await projectPathService.getRelativePathFromProject(upperFilePath);
      assert.strictEqual(result, null);
    });

    it('サブディレクトリ内のファイルも正しく相対パス変換される', async () => {
      // サブディレクトリ構造を作成
      const subDirPath = path.join(testProjectPath, 'contents');
      const fileInSubDir = path.join(subDirPath, 'chapter3.txt');
      mockFileRepository.addFile(fileInSubDir, 'サブディレクトリ内の章');

      const result = await projectPathService.getRelativePathFromProject(fileInSubDir);
      assert.ok(result !== null);
      assert.strictEqual(result.projectRoot, testProjectPath);
      assert.strictEqual(result.relativePath, 'contents/chapter3.txt');
    });

    it('パス区切り文字の正規化が正しく動作する', async () => {
      // 既存のファイル（chapter1.txt）を使用してパス区切り文字の正規化をテスト
      const normalPath = path.join(testProjectPath, 'chapter1.txt');

      const result = await projectPathService.getRelativePathFromProject(normalPath);
      assert.ok(result !== null);
      assert.strictEqual(result.projectRoot, testProjectPath);
      // 結果は常にスラッシュ区切りになることを確認
      assert.strictEqual(result.relativePath, 'chapter1.txt');
      assert.ok(!result.relativePath.includes('\\'));
    });

    it('プロジェクトルート自体のファイルも正しく処理される', async () => {
      // プロジェクトルート直下のREADME.md
      const readmePath = path.join(testProjectPath, 'README.md');
      mockFileRepository.addFile(readmePath, '# README');

      const result = await projectPathService.getRelativePathFromProject(readmePath);
      assert.ok(result !== null);
      assert.strictEqual(result.projectRoot, testProjectPath);
      assert.strictEqual(result.relativePath, 'README.md');
    });

    it('深いネスト構造でも正しく動作する', async () => {
      // 深いディレクトリ構造を作成
      const deepPath = path.join(testProjectPath, 'a', 'b', 'c', 'd', 'file.txt');
      mockFileRepository.addFile(deepPath, 'Deep nested file');

      const result = await projectPathService.getRelativePathFromProject(deepPath);
      assert.ok(result !== null);
      assert.strictEqual(result.projectRoot, testProjectPath);
      assert.strictEqual(result.relativePath, 'a/b/c/d/file.txt');
    });
  });
});
