/**
 * プロジェクト設定に関する型定義
 */

export interface ProjectSettingsData {
  title: string;
  author: string;
  version: string;
  tags?: string[];
  project_settings?: {
    readme_filename?: string;
    exclude_patterns?: string[];
  };
  created_at: string;
  updated_at?: string;
}

export interface ProjectSettingsUpdateData {
  title: string;
  author: string;
  version: string;
  tags?: string[];
  project_settings?: {
    readme_filename?: string;
    exclude_patterns?: string[];
  };
}

export interface ProjectSettingsValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ProjectSettingsMessage {
  command: 'saveSettings' | 'validateField' | 'openYamlEditor' | 'ready';
  data?: ProjectSettingsUpdateData | { field: string; value: string };
}

export interface ProjectSettingsState {
  settings: ProjectSettingsData | null;
  isDialogoiProject: boolean;
  validation: ProjectSettingsValidationResult;
  isLoading: boolean;
}

export interface UpdateProjectSettingsMessage {
  type: 'updateSettings';
  data: {
    settings: ProjectSettingsData | null;
    isDialogoiProject: boolean;
    isNewProject?: boolean;
  };
}

export interface SaveResultMessage {
  type: 'saveResult';
  data: {
    success: boolean;
    message: string;
  };
}

export type ProjectSettingsWebViewMessage = UpdateProjectSettingsMessage | SaveResultMessage;

export interface VSCodeProjectSettingsApi {
  postMessage: (message: ProjectSettingsMessage) => void;
}
