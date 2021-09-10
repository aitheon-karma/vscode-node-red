import * as path from 'path';
import * as vscode from 'vscode';
import { GraphApp } from './graph-app';
import { Project } from './project';
import * as http from 'http';
import { AppComponent } from './app-component';
import { BASE_HTML } from './shared/constants';
import { render } from 'mustache';
import { checkLiveness } from './shared/helpers';

/**
 * Provider for cat scratch editors.
 */
export class GraphAppComponentEditorProvider implements vscode.CustomTextEditorProvider {

	private static readonly viewType = 'app-component.editor';
	public static register(context: vscode.ExtensionContext, graphApp: AppComponent): vscode.Disposable {

		const provider = new GraphAppComponentEditorProvider(context, graphApp);
		const providerRegistration = vscode.window.registerCustomEditorProvider(GraphAppComponentEditorProvider.viewType, provider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		});
		return providerRegistration;
	}

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly appComponent: AppComponent
	) {

	}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		return new Promise(async (resolve) => {
			// resolve();
			webviewPanel.webview.options = {
				enableScripts: true
			};
			webviewPanel.webview.html = render(BASE_HTML, {text: 'Loading, please wait...'});
			resolve();

			const project = JSON.parse(document.getText()) as Project;
			const port = await this.appComponent.startComponentApps(project);
			const edit = new vscode.WorkspaceEdit();
			const loadUI = () => {
				const interval = setInterval(async () => {
					const live = await checkLiveness(port);
					if(live) {
						webviewPanel.webview.html = await this.appComponent.getHtml(port, project.slug);
						await this.appComponent.viewer(project);
						clearInterval(interval);
					}
				}, 600);
			};


			webviewPanel.webview.onDidReceiveMessage(async message => {
				if (message.command === 'apply-changes') {
					//this.appComponent.restart(project);
					webviewPanel.webview.html = render(BASE_HTML, {text: 'Compiling, please wait...'});
					await this.appComponent.restart(project);
					await this.appComponent.closeViewer(project);
					loadUI();
				}
			}, undefined);


			edit.replace(
				document.uri,
				new vscode.Range(0, 0, document.lineCount, 0),
				document.getText()
			);
			await vscode.workspace.applyEdit(edit);
			setTimeout(async () => { await document.save(); }, 1);
			loadUI();
		});

	}
}
