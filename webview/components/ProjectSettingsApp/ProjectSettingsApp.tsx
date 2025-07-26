import React, { useState, useEffect } from 'react';
import type {
  ProjectSettingsData,
  ProjectSettingsUpdateData,
  ProjectSettingsMessage,
  ProjectSettingsWebViewMessage,
  ProjectSettingsValidationResult,
} from '../../types/ProjectSettings';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';

export const ProjectSettingsApp: React.FC = () => {
  const [settings, setSettings] = useState<ProjectSettingsData | null>(null);
  const [isDialogoiProject, setIsDialogoiProject] = useState(false);
  const [isNewProject, setIsNewProject] = useState(false);
  const [formData, setFormData] = useState<ProjectSettingsUpdateData>({
    title: '',
    author: '',
    tags: [],
    project_settings: {
      readme_filename: '',
      exclude_patterns: [],
    },
  });
  const [validation, setValidation] = useState<ProjectSettingsValidationResult>({
    isValid: true,
    errors: {},
  });
  const [newTag, setNewTag] = useState('');
  const [excludePatternsText, setExcludePatternsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { postMessage, isVSCodeReady } = useVSCodeApi<ProjectSettingsMessage>({ command: 'ready' });

  // Extensionからのメッセージリスナー
  useEffect((): (() => void) => {
    const handleMessage = (event: MessageEvent<ProjectSettingsWebViewMessage>): void => {
      const message = event.data;
      if (message.type === 'updateSettings') {
        setSettings(message.data.settings);
        setIsDialogoiProject(message.data.isDialogoiProject);
        setIsNewProject(message.data.isNewProject || false);

        // 初期読み込み時または保存中でない場合のみフォームデータを更新
        if (isInitialLoad && !isSaving) {
          if (message.data.settings) {
            const excludePatterns = message.data.settings.project_settings?.exclude_patterns || [];
            setFormData({
              title: message.data.settings.title,
              author: message.data.settings.author,
              tags: message.data.settings.tags || [],
              project_settings: {
                readme_filename: message.data.settings.project_settings?.readme_filename || '',
                exclude_patterns: excludePatterns,
              },
            });
            setExcludePatternsText(excludePatterns.join('\n'));
          } else if (message.data.isNewProject) {
            // 新規プロジェクトの場合はデフォルト値を設定
            // 新規プロジェクトのデフォルト値
            const defaultExcludePatterns = [
              '.*',                 // 隠しファイル・ディレクトリ
              '.DS_Store',          // macOS システムファイル
              'Thumbs.db',          // Windows システムファイル
              'desktop.ini',        // Windows システムファイル
              '$RECYCLE.BIN',       // Windows ゴミ箱
              '.Trash',             // macOS ゴミ箱
              '.git',               // Git リポジトリ
              '.gitignore',         // Git 設定
              '.hg',                // Mercurial
              '.svn',               // Subversion
              '*.tmp',              // 一時ファイル
              '*.temp',             // 一時ファイル
              '*.log',              // ログファイル
              '*.bak',              // バックアップファイル
              '*.old',              // 古いファイル
              'node_modules',       // Node.js 依存関係
              'dist',               // ビルド成果物
              'build',              // ビルド成果物
            ];
            
            setFormData({
              title: '',
              author: '',
              tags: [],
              project_settings: {
                readme_filename: 'README.md',
                exclude_patterns: defaultExcludePatterns,
              },
            });
            setExcludePatternsText(defaultExcludePatterns.join('\n'));
          }
          setIsInitialLoad(false);
        }
      } else if (message.type === 'saveResult') {
        // 保存完了時にフラグをリセット
        setIsSaving(false);

        // 新規プロジェクト作成成功時は、パネルを閉じる
        if (message.data.success && isNewProject) {
          setIsInitialLoad(true);
          // プロジェクト作成成功後、パネルを閉じる
          postMessage({ command: 'closePanel' });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return (): void => window.removeEventListener('message', handleMessage);
  }, [isInitialLoad, isSaving, isNewProject, postMessage]);

  // バリデーション
  const validateForm = (tagsOverride?: string[]): ProjectSettingsValidationResult => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'タイトルは必須です';
    }

    if (!formData.author.trim()) {
      errors.author = '著者は必須です';
    }

    // 重複チェック（パラメータで上書きされた場合はそれを使用）
    const tags = tagsOverride !== undefined ? tagsOverride : formData.tags || [];
    const duplicateTags = tags.filter((tag, index) => tags.indexOf(tag) !== index);
    if (duplicateTags.length > 0) {
      errors.tags = `重複するタグがあります: ${duplicateTags.join(', ')}`;
    }

    // テキストエリアから解析されたパターンの重複チェック
    const patterns = excludePatternsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const duplicatePatterns = patterns.filter(
      (pattern, index) => patterns.indexOf(pattern) !== index,
    );
    if (duplicatePatterns.length > 0) {
      errors.exclude_patterns = `重複する除外パターンがあります: ${duplicatePatterns.join(', ')}`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  // 自動保存
  const autoSave = (): void => {
    const validationResult = validateForm();
    setValidation(validationResult);

    if (validationResult.isValid) {
      // 保存開始フラグを設定
      setIsSaving(true);

      // テキストエリアから除外パターン配列を生成
      const excludePatterns = excludePatternsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // 空の配列や文字列はundefinedに変換
      const dataToSave: ProjectSettingsUpdateData = {
        ...formData,
        tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
        project_settings: {
          readme_filename: formData.project_settings?.readme_filename?.trim() || undefined,
          exclude_patterns: excludePatterns.length > 0 ? excludePatterns : undefined,
        },
      };

      // project_settingsが空の場合はundefinedに
      if (
        !dataToSave.project_settings?.readme_filename &&
        (!dataToSave.project_settings?.exclude_patterns ||
          dataToSave.project_settings.exclude_patterns.length === 0)
      ) {
        dataToSave.project_settings = undefined;
      }

      postMessage({
        command: 'saveSettings',
        data: dataToSave,
      });
    }
  };

  // YAML直接編集
  const handleOpenYamlEditor = (): void => {
    postMessage({ command: 'openYamlEditor' });
  };

  // 各フィールドのフォーカスアウト時にバリデーションのみ実行（新規プロジェクトでは自動保存しない）
  const handleFieldBlur = (): void => {
    // バリデーション実行
    const validationResult = validateForm();
    setValidation(validationResult);

    // 新規プロジェクトでは自動保存せず、既存プロジェクトのみ自動保存
    if (validationResult.isValid && !isNewProject) {
      autoSave();
    }
  };

  // タグ追加
  const handleAddTag = (): void => {
    const tag = newTag.trim();
    if (tag && !formData.tags?.includes(tag)) {
      const updatedTags = [...(formData.tags || []), tag];
      const updatedFormData = {
        ...formData,
        tags: updatedTags,
      };
      setFormData(updatedFormData);
      setNewTag('');

      // タグ追加後、バリデーション実行（新規プロジェクトでは自動保存しない）
      setTimeout(() => {
        // 更新されたタグ配列を使ってバリデーション実行
        const validationResult = validateForm(updatedTags);
        setValidation(validationResult);

        // 既存プロジェクトのみ自動保存
        if (validationResult.isValid && !isNewProject) {
          setIsSaving(true);

          const excludePatterns = excludePatternsText
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          const dataToSave: ProjectSettingsUpdateData = {
            ...updatedFormData,
            tags: updatedTags.length > 0 ? updatedTags : undefined,
            project_settings: {
              readme_filename:
                updatedFormData.project_settings?.readme_filename?.trim() || undefined,
              exclude_patterns: excludePatterns.length > 0 ? excludePatterns : undefined,
            },
          };

          if (
            !dataToSave.project_settings?.readme_filename &&
            (!dataToSave.project_settings?.exclude_patterns ||
              dataToSave.project_settings.exclude_patterns.length === 0)
          ) {
            dataToSave.project_settings = undefined;
          }

          postMessage({
            command: 'saveSettings',
            data: dataToSave,
          });
        }
      }, 50);
    }
  };

  // タグ削除
  const handleRemoveTag = (tagToRemove: string): void => {
    const updatedTags = formData.tags?.filter((tag) => tag !== tagToRemove) || [];
    const updatedFormData = {
      ...formData,
      tags: updatedTags,
    };
    setFormData(updatedFormData);

    // タグ削除後、バリデーション実行（新規プロジェクトでは自動保存しない）
    setTimeout(() => {
      // 更新されたタグ配列を使ってバリデーション実行
      const validationResult = validateForm(updatedTags);
      setValidation(validationResult);

      // 既存プロジェクトのみ自動保存
      if (validationResult.isValid && !isNewProject) {
        setIsSaving(true);

        const excludePatterns = excludePatternsText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        const dataToSave: ProjectSettingsUpdateData = {
          ...updatedFormData,
          tags: updatedTags.length > 0 ? updatedTags : undefined,
          project_settings: {
            readme_filename: updatedFormData.project_settings?.readme_filename?.trim() || undefined,
            exclude_patterns: excludePatterns.length > 0 ? excludePatterns : undefined,
          },
        };

        if (
          !dataToSave.project_settings?.readme_filename &&
          (!dataToSave.project_settings?.exclude_patterns ||
            dataToSave.project_settings.exclude_patterns.length === 0)
        ) {
          dataToSave.project_settings = undefined;
        }

        postMessage({
          command: 'saveSettings',
          data: dataToSave,
        });
      }
    }, 50);
  };

  // 除外パターンのテキストエリア変更処理
  const handleExcludePatternsChange = (value: string): void => {
    setExcludePatternsText(value);

    // 改行で分割し、空行と前後の空白を除去
    const patterns = value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    setFormData((prev) => ({
      ...prev,
      project_settings: {
        ...prev.project_settings,
        exclude_patterns: patterns,
      },
    }));
  };

  // エンターキーでタグ追加
  const handleTagKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  };

  if (!isDialogoiProject && !isNewProject) {
    return (
      <div className="no-project">
        <h3>📋 プロジェクト設定</h3>
        <p>Dialogoiプロジェクトが見つかりません。</p>
        <p>新しいプロジェクトを作成するか、既存のDialogoiプロジェクトを開いてください。</p>
      </div>
    );
  }

  if (!settings && !isNewProject) {
    return (
      <div className="error">
        <h3>❌ エラー</h3>
        <p>プロジェクト設定の読み込みに失敗しました。</p>
        <button className="tertiary" onClick={handleOpenYamlEditor}>
          📝 YAML直接編集
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h3>{isNewProject ? '🆕 新しい小説プロジェクトの作成' : '📋 プロジェクト設定'}</h3>

      {!isVSCodeReady && <div className="warning">VSCode API初期化中...</div>}

      {/* 基本情報セクション */}
      <div className="section">
        <span className="section-title">📖 基本情報</span>
        <div className="form-group">
          <label htmlFor="title">タイトル *</label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            onBlur={handleFieldBlur}
            required
          />
          {validation.errors.title && (
            <span className="error-message">{validation.errors.title}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="author">著者 *</label>
          <input
            type="text"
            id="author"
            value={formData.author}
            onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
            onBlur={handleFieldBlur}
            required
          />
          {validation.errors.author && (
            <span className="error-message">{validation.errors.author}</span>
          )}
        </div>
      </div>

      {/* タグ管理セクション */}
      <div className="section">
        <span className="section-title">🏷️ タグ</span>
        <div className="tags-container">
          {formData.tags?.map((tag) => (
            <span key={tag} className="tag">
              {tag}
              <button className="tag-remove" onClick={() => handleRemoveTag(tag)}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="add-tag-form">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="新しいタグを入力してEnterキーを押してください"
            onKeyDown={handleTagKeyPress}
          />
        </div>
        {validation.errors.tags && <span className="error-message">{validation.errors.tags}</span>}
      </div>

      {/* プロジェクト設定セクション */}
      <div className="section">
        <span className="section-title">⚙️ プロジェクト設定</span>
        <div className="form-group">
          <label htmlFor="readme-filename">READMEファイル名</label>
          <input
            type="text"
            id="readme-filename"
            value={formData.project_settings?.readme_filename || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                project_settings: {
                  ...prev.project_settings,
                  readme_filename: e.target.value,
                },
              }))
            }
            onBlur={handleFieldBlur}
            placeholder="README.md"
          />
          <span className="help-text">ディレクトリクリック時に開くファイル名</span>
        </div>

        <div className="form-group">
          <label htmlFor="exclude-patterns">除外パターン</label>
          <textarea
            id="exclude-patterns"
            value={excludePatternsText}
            onChange={(e) => handleExcludePatternsChange(e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="除外するパターンを1行ずつ入力してください&#10;例:&#10;*.tmp&#10;node_modules/&#10;.git/"
            rows={5}
          />
          <span className="help-text">
            ファイルスキャン時に除外するパターン（glob形式、1行につき1パターン）
          </span>
          {validation.errors.exclude_patterns && (
            <span className="error-message">{validation.errors.exclude_patterns}</span>
          )}
        </div>
      </div>

      {/* メタデータ情報（既存プロジェクトのみ） */}
      {!isNewProject && settings && (
        <div className="section">
          <span className="section-title">ℹ️ メタデータ</span>
          <div className="metadata-info">
            <div>作成日: {new Date(settings.created_at).toLocaleString()}</div>
            {settings.updated_at && (
              <div>更新日: {new Date(settings.updated_at).toLocaleString()}</div>
            )}
          </div>
        </div>
      )}

      {/* 新規プロジェクト作成時のみ操作ボタン表示 */}
      {isNewProject && (
        <div className="actions">
          <button
            className="primary"
            onClick={autoSave}
            disabled={!validation.isValid || !formData.title.trim() || !formData.author.trim()}
          >
            ✨ プロジェクトを作成
          </button>
          {!validation.isValid && (
            <div className="error-message">
              入力エラーがあります。修正してからプロジェクトを作成してください。
            </div>
          )}
        </div>
      )}

      {/* 既存プロジェクトではYAML直接編集ボタンのみ */}
      {!isNewProject && (
        <div className="actions">
          <button className="tertiary" onClick={handleOpenYamlEditor}>
            📝 YAML直接編集
          </button>
        </div>
      )}
    </div>
  );
};
