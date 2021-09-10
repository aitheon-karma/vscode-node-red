"use strict";
import * as vscode from "vscode";
import { GraphApp } from "./graph-app";
import { GraphAppEditorProvider } from "./graph-app.editor";
import { readJSON } from "fs-extra";
import { Project } from "./project";
import { GraphAppComponentEditorProvider } from "./app-component-editor";
import { AppComponent } from "./app-component";

export function activate(context: vscode.ExtensionContext) {
	const graphApp = new GraphApp(context);
	const appComponent = new AppComponent(context);

	console.log('Aitheon Graph Extension Activated');
	context.subscriptions.push(GraphAppEditorProvider.register(context, graphApp));
	context.subscriptions.push(GraphAppComponentEditorProvider.register(context, appComponent));


	vscode.commands.registerCommand('graph-app.viewer', async (file: { path: string }) => {
		const project = await readJSON(file.path) as Project;
		graphApp.viewer(project);
	});
	vscode.commands.registerCommand('graph-app.viewer.new-tab', async (file: { path: string }) => {
		const project = await readJSON(file.path) as Project;
		const url = await graphApp.getBaseUrl(project);
		vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${url}/ui/`));
	});
	vscode.commands.registerCommand('graph-app.restart', async (file: { path: string }) => {
		const project = await readJSON(file.path) as Project;
		await graphApp.close(project);
		await graphApp.open(project);
	});




	vscode.commands.registerCommand('graph-app.component.viewer', async (file: { path: string }) => {
		const project = await readJSON(file.path) as Project;
		appComponent.viewer(project);
	});


}


export function deactivate() {
}
