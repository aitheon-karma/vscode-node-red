"use strict";
import * as vscode from "vscode";
import { Project } from "./project";
import { NodeRedServer } from "./node-red.server";
import { readJSON } from "fs-extra";
import { ChildProcess } from "child_process";

const runningProjects: { [projectId: string]: {
  project: Project,
  uiPort: number,
  redProcess: ChildProcess
 } } = {};

export class GraphApp {
  
  constructor(private readonly context: vscode.ExtensionContext){
  }

  async open(project: Project): Promise<number> {
    
    if (runningProjects[project._id]){
        // runningProjects[project._id].webviewPanel.reveal();
        console.log("reveal webviewPanel");
        return runningProjects[project._id].uiPort;
    }

    const debug = process.env.DEBUG === 'true';
    const pwd = debug ? process.env.DEBUG_PWD : process.env.PWD;

    const nodeRedServer = new NodeRedServer(this.context.extensionPath, pwd as string);
    runningProjects[project._id] = {
      project,
      ...await nodeRedServer.start(project)
    };
    return runningProjects[project._id].uiPort;
  }

  async viewer(project: Project){
    const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;
		const panel = vscode.window.createWebviewPanel(
			'graph-app.viewer',
			`Preview: ${ project.name }`,
			vscode.ViewColumn.Two,
			{
				// Enable javascript in the webview
				enableScripts: true,
			}
    );
    const sandbox = await this.getBaseUrl(project, true) as {url: string, config: any}; 
    const url = `${ sandbox.url }/ui/?edit=true`;
    panel.webview.html = await this.getPreviewIframe(url);

    const payload = {
        type: 'credentials',
        payload: {
          token: sandbox.config.token,
          organizationId: sandbox.config.organization,
          baseHost: sandbox.config.domain,
          projectId: project._id,
          fullUrl: sandbox.url,
        }
    };
    panel.webview.onDidReceiveMessage(message => {
      if(message.command === 'ready') {
        setTimeout(() => { panel.webview.postMessage(payload); }, 80);
      }
    },undefined);
    panel.reveal();

  }

  async close(project: Project){
    const runner = runningProjects[project._id];
    if (!runner){
      return console.log("project not running");
    }
    runner.redProcess.kill();
    delete runningProjects[project._id];
  }

  async getHtml(project: Project){
    const url = await this.getBaseUrl(project);
    const html = this.getBasicIframe(url as string);
    return html;
  }

  async getBasicIframe(url: string){
    return `
    <body style="margin:0px;padding:0px;overflow:hidden">
      <iframe  src="${url}" frameborder="0" style="overflow:hidden;overflow-x:hidden;overflow-y:hidden;height:100%;width:100%;position:absolute;top:0px;left:0px;right:0px;bottom:0px" height="100%" width="100%"></iframe>
    </body>`;
  }

  async getPreviewIframe(url: string){
    return `
    <body style="margin:0px;padding:0px;overflow:hidden">
      <iframe onload="notifyVsCode()" src="${url}" id="aitheonFrame" frameborder="0" style="overflow:hidden;overflow-x:hidden;overflow-y:hidden;height:100%;width:100%;position:absolute;top:0px;left:0px;right:0px;bottom:0px" height="50%" width="100%"></iframe>
      <script>
         window.addEventListener('message', event => { 
           document.getElementById('aitheonFrame').contentWindow.postMessage(event.data, '*');
        });
        function notifyVsCode() {
          const vscode = acquireVsCodeApi();
          vscode.postMessage({command: 'ready'})
        } 
      </script>
    </body>`;
  }

  async getBaseUrl(project: Project, config: boolean = false){
    if (!runningProjects[project._id]){
      console.log('[getBaseUrl] Project not running');
      return '';
    }
    const uiPort = runningProjects[project._id].uiPort;
    const debug = process.env.DEBUG === 'true';
    const pwd = debug ? process.env.DEBUG_PWD : process.env.PWD;
    const sandboxConfig = await readJSON(`${ pwd }/.local/share/sandbox.json`);
    const url = debug ? `http://localhost:${ uiPort }` : `https://ws.${ sandboxConfig.domain }/sandboxes/${ sandboxConfig.sandbox }/proxy/${ uiPort }`;
    return config ? {config: sandboxConfig, url} : url;
  }
  
}