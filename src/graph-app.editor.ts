import * as path from 'path';
import * as vscode from 'vscode';
import { GraphApp } from './graph-app';
import { Project } from './project';
import * as http from 'http';
import { checkLiveness } from './shared/helpers';

/**
 * Provider for cat scratch editors.
 */
export class GraphAppEditorProvider implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext, graphApp: GraphApp): vscode.Disposable {
		const provider = new GraphAppEditorProvider(context, graphApp);
		const providerRegistration = vscode.window.registerCustomEditorProvider(GraphAppEditorProvider.viewType, provider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		});
		return providerRegistration;
	}

	private static readonly viewType = 'graph-app.editor';

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly graphApp: GraphApp
	) {

	}

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		return new Promise(async (resolve) => {
			// resolve();
			webviewPanel.webview.options = {
				enableScripts: true,
			};
			const project = JSON.parse(document.getText()) as Project;
			const port = await this.graphApp.open(project);
			const edit = new vscode.WorkspaceEdit();

			const loadUI = () => {
				const interval = setInterval(async () => {
					const live = await checkLiveness(port);
					if (live){
						webviewPanel.webview.html = await this.graphApp.getHtml(project);
						clearInterval(interval);
						return resolve();
					}
				}, 600);
			};
			edit.replace(
				document.uri,
				new vscode.Range(0, 0, document.lineCount, 0),
				document.getText()
			);
			await vscode.workspace.applyEdit(edit);
			setTimeout(async () => {	await document.save(); }, 1);
			loadUI();
		});

	}
}
