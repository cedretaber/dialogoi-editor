import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Dialogoi Editor が起動しました');

  const disposable = vscode.commands.registerCommand('dialogoi.refreshExplorer', () => {
    vscode.window.showInformationMessage('Dialogoi Explorer を更新しました');
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // cleanup
}
