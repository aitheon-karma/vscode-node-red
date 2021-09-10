"use strict";
import * as vscode from "vscode";
import { Project } from "./project";
import { NodeRedServer } from "./node-red.server";
import { readJSON } from "fs-extra";
import { ChildProcess, exec } from "child_process";
import { killProcessByPort } from "./shared/helpers";

const runningProjects: {[projectSlug: string]: {uiPort: number, project: Project, nodeRedProcess: ChildProcess, viewer?: vscode.WebviewPanel}} = {};
export class AppComponent {
  
  constructor(private readonly context: vscode.ExtensionContext) {
  }

  
  async startComponentApps(project: Project): Promise<number> {
    if (runningProjects[project.slug]) {
      // runningProjects[project._id].webviewPanel.reveal();
      console.log("reveal webviewPanel");
      return runningProjects[project.slug].uiPort;
    }

    const debug = process.env.DEBUG === 'true';
    const pwd = debug ? process.env.DEBUG_PWD : process.env.PWD;
    const nodeRedServer = new NodeRedServer(this.context.extensionPath, pwd as string);
    const server = await nodeRedServer.startForAppComponent(project);
    runningProjects[project.slug] ={uiPort: server.uiPort, nodeRedProcess: server.nodeRedProcess, project: project};
    return server.uiPort;
  }


  async getBaseUrl(project: Project, config: boolean = false) {
    if (!runningProjects[project.slug]) {
      console.log('[getBaseUrl] Project not running');
      return '';
    }
    const uiPort = project.uiPort || runningProjects[project.slug].uiPort;
    const debug = process.env.DEBUG === 'true';
    const pwd = debug ? process.env.DEBUG_PWD : process.env.PWD;
    const sandboxConfig = await readJSON(`${pwd}/.local/share/sandbox.json`);
    const url = debug ? `http://localhost:${uiPort}` : `https://ws.${sandboxConfig.domain}/sandboxes/${sandboxConfig.sandbox}/proxy/${uiPort}`;
    return config ? { config: sandboxConfig, url } : url;
  }

  async getBasicIframe(url: string) {
    return `
    <body style="margin:0px;padding:0px;overflow:hidden; width:100%;height:100%">
    <button id="refresh-button" 
            onclick="applyChanges()"
            style="height:30px; 
                  width: 129px;
                  background: #dcbc65; 
                  border: none;
                  position:absolute;
                  top:5px;
                  right:210px; 
                  font-weight:bold;
                  z-index:1000;
                  border-radius:2px; 
                  cursor: pointer;"> 
      Apply Changes
    </button> 

      <iframe  src="${url}" frameborder="0" style="overflow:hidden;overflow-x:hidden;overflow-y:hidden;height:100%;width:100%;position:absolute;top:0px;left:0px;right:0px;bottom:0px" height="100%" width="100%"></iframe>
      <script>
        let vscode;

        function applyChanges() {
          if(!vscode) {
            vscode = acquireVsCodeApi();
          }
          vscode.postMessage({command: 'apply-changes'});
        }
        </script>
      </body>`;
  }

  async getPreviewIframe(url: string) {
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

  async getHtml(uiPort: number, projectSlug: string) {
    const url = await this.getBaseUrl({uiPort, slug: projectSlug} as any);
    const html = this.getBasicIframe(url as string);
    return html;
  }

  async viewer(project: Project){

    if(runningProjects[project.slug].viewer) {
      return runningProjects[project.slug].viewer?.reveal();
    }

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
    runningProjects[project.slug].viewer = panel;
    panel.reveal();
    panel.onDidDispose(e => {
      runningProjects[project.slug].viewer = undefined;
    });
  }


  async restart(project: Project) {
      const runningProject = runningProjects[project.slug];
      if(!runningProject) {
        return console.log('Project not running', project.slug);
      }
      runningProject.nodeRedProcess.kill(0);
      await killProcessByPort(runningProject.uiPort);
      const debug = process.env.DEBUG === 'true';
      const pwd = debug ? process.env.DEBUG_PWD : process.env.PWD;
      const nodeRedServer = new NodeRedServer(this.context.extensionPath, pwd as string);
      const server = await nodeRedServer.startForAppComponent(project, runningProject.uiPort);
      runningProjects[project.slug] ={uiPort: server.uiPort, nodeRedProcess: server.nodeRedProcess, project: project, viewer: runningProjects[project.slug].viewer};
  }

  async closeViewer(project: Project) {
    if(runningProjects[project.slug].viewer) {
      (runningProjects[project.slug].viewer as any).dispose();
    }
  }

}