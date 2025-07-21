import React, { useState, useEffect } from 'react';
import type {
  ProjectSettingsData,
  ProjectSettingsUpdateData,
  ProjectSettingsMessage,
  ProjectSettingsWebViewMessage,
  ProjectSettingsValidationResult,
} from '../types/ProjectSettings';
import { useVSCodeApi } from '../hooks/useVSCodeApi';

// セマンティックバージョンの検証
const isValidSemanticVersion = (version: string): boolean => {
  const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
};

export const ProjectSettingsApp: React.FC = () => {
  const [settings, setSettings] = useState<ProjectSettingsData | null>(null);
  const [isDialogoiProject, setIsDialogoiProject] = useState(false);
  const [formData, setFormData] = useState<ProjectSettingsUpdateData>({
    title: '',
    author: '',
    version: '',
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
  const [newPattern, setNewPattern] = useState('');

  const { postMessage, isVSCodeReady } = useVSCodeApi<ProjectSettingsMessage>({ command: 'ready' });

  // Extensionからのメッセージリスナー
  useEffect((): (() => void) => {
    const handleMessage = (event: MessageEvent<ProjectSettingsWebViewMessage>): void => {
      const message = event.data;
      if (message.type === 'updateSettings') {
        setSettings(message.data.settings);
        setIsDialogoiProject(message.data.isDialogoiProject);

        if (message.data.settings) {
          setFormData({
            title: message.data.settings.title,
            author: message.data.settings.author,
            version: message.data.settings.version,
            tags: message.data.settings.tags || [],
            project_settings: {
              readme_filename: message.data.settings.project_settings?.readme_filename || '',
              exclude_patterns: message.data.settings.project_settings?.exclude_patterns || [],
            },
          });
        }
      } else if (message.type === 'saveResult') {
        // 保存結果は既にVSCodeでメッセージ表示されるため、ここでは何もしない
      }
    };

    window.addEventListener('message', handleMessage);
    return (): void => window.removeEventListener('message', handleMessage);
  }, []);

  // バリデーション
  const validateForm = (): ProjectSettingsValidationResult => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'タイトルは必須です';
    }

    if (!formData.author.trim()) {
      errors.author = '著者は必須です';
    }

    if (!formData.version.trim()) {
      errors.version = 'バージョンは必須です';
    } else if (!isValidSemanticVersion(formData.version)) {
      errors.version = 'セマンティックバージョニング形式で入力してください（例: 1.0.0）';
    }

    // 重複チェック
    const tags = formData.tags || [];
    const duplicateTags = tags.filter((tag, index) => tags.indexOf(tag) !== index);
    if (duplicateTags.length > 0) {
      errors.tags = `重複するタグがあります: ${duplicateTags.join(', ')}`;
    }

    const patterns = formData.project_settings?.exclude_patterns || [];
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

  // フォーム送信
  const handleSave = (): void => {
    const validationResult = validateForm();
    setValidation(validationResult);

    if (validationResult.isValid) {
      // 空の配列や文字列はundefinedに変換
      const dataToSave: ProjectSettingsUpdateData = {
        ...formData,
        tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
        project_settings: {
          readme_filename: formData.project_settings?.readme_filename?.trim() || undefined,
          exclude_patterns:
            formData.project_settings?.exclude_patterns &&
            formData.project_settings.exclude_patterns.length > 0
              ? formData.project_settings.exclude_patterns
              : undefined,
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

  // キャンセル
  const handleCancel = (): void => {
    if (settings) {
      setFormData({
        title: settings.title,
        author: settings.author,
        version: settings.version,
        tags: settings.tags || [],
        project_settings: {
          readme_filename: settings.project_settings?.readme_filename || '',
          exclude_patterns: settings.project_settings?.exclude_patterns || [],
        },
      });
    }
    setValidation({ isValid: true, errors: {} });
  };

  // YAML直接編集
  const handleOpenYamlEditor = (): void => {
    postMessage({ command: 'openYamlEditor' });
  };

  // タグ追加
  const handleAddTag = (): void => {
    const tag = newTag.trim();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tag],
      }));
      setNewTag('');
    }
  };

  // タグ削除
  const handleRemoveTag = (tagToRemove: string): void => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((tag) => tag !== tagToRemove) || [],
    }));
  };

  // 除外パターン追加
  const handleAddPattern = (): void => {
    const pattern = newPattern.trim();
    if (pattern && !formData.project_settings?.exclude_patterns?.includes(pattern)) {
      setFormData((prev) => ({
        ...prev,
        project_settings: {
          ...prev.project_settings,
          exclude_patterns: [...(prev.project_settings?.exclude_patterns || []), pattern],
        },
      }));
      setNewPattern('');
    }
  };

  // 除外パターン削除
  const handleRemovePattern = (patternToRemove: string): void => {
    setFormData((prev) => ({
      ...prev,
      project_settings: {
        ...prev.project_settings,
        exclude_patterns:
          prev.project_settings?.exclude_patterns?.filter(
            (pattern) => pattern !== patternToRemove,
          ) || [],
      },
    }));
  };

  // エンターキーでタグ追加
  const handleTagKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  };

  // エンターキーでパターン追加
  const handlePatternKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleAddPattern();
    }
  };

  if (!isDialogoiProject) {
    return (
      <div className="no-project">
        <h3>📋 プロジェクト設定</h3>
        <p>Dialogoiプロジェクトが見つかりません。</p>
        <p>新しいプロジェクトを作成するか、既存のDialogoiプロジェクトを開いてください。</p>
      </div>
    );
  }

  if (!settings) {
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
      <h3>📋 プロジェクト設定</h3>

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
            required
          />
          {validation.errors.author && (
            <span className="error-message">{validation.errors.author}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="version">バージョン *</label>
          <input
            type="text"
            id="version"
            value={formData.version}
            onChange={(e) => setFormData((prev) => ({ ...prev, version: e.target.value }))}
            placeholder="1.0.0"
          />
          {validation.errors.version && (
            <span className="error-message">{validation.errors.version}</span>
          )}
          <span className="help-text">セマンティックバージョニング形式（例: 1.0.0）</span>
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
            placeholder="新しいタグを入力"
            onKeyDown={handleTagKeyPress}
          />
          <button onClick={handleAddTag}>追加</button>
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
            placeholder="README.md"
          />
          <span className="help-text">ディレクトリクリック時に開くファイル名</span>
        </div>

        <div className="form-group">
          <label>除外パターン</label>
          <div className="exclude-patterns">
            {formData.project_settings?.exclude_patterns?.map((pattern) => (
              <span key={pattern} className="exclude-pattern">
                {pattern}
                <button className="pattern-remove" onClick={() => handleRemovePattern(pattern)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="add-pattern-form">
            <input
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="例: *.tmp"
              onKeyDown={handlePatternKeyPress}
            />
            <button onClick={handleAddPattern}>追加</button>
          </div>
          <span className="help-text">ファイルスキャン時に除外するパターン（glob形式）</span>
          {validation.errors.exclude_patterns && (
            <span className="error-message">{validation.errors.exclude_patterns}</span>
          )}
        </div>
      </div>

      {/* メタデータ情報 */}
      <div className="section">
        <span className="section-title">ℹ️ メタデータ</span>
        <div className="metadata-info">
          <div>作成日: {new Date(settings.created_at).toLocaleString()}</div>
          {settings.updated_at && (
            <div>更新日: {new Date(settings.updated_at).toLocaleString()}</div>
          )}
        </div>
      </div>

      {/* 操作ボタン */}
      <div className="actions">
        <button className="primary" onClick={handleSave}>
          💾 保存
        </button>
        <button className="secondary" onClick={handleCancel}>
          ❌ キャンセル
        </button>
        <button className="tertiary" onClick={handleOpenYamlEditor}>
          📝 YAML直接編集
        </button>
      </div>
    </div>
  );
};
