"use strict";

import { Project } from "./project";
import { spawn } from 'child_process';
import * as getPort from 'get-port';
import { ensureDir, writeJson, writeFile, pathExists, ensureDirSync, writeJSON, copyFile, readJSON, readFile, copy, remove } from "fs-extra";
import { ComponentCompiler } from "./component-compiler";


export class NodeRedServer {

  componentCompiler: ComponentCompiler;
  constructor(private extensionPath: string, private pwd: string) {
    this.componentCompiler = new ComponentCompiler();
  }

  public async start(project: Project) {
    // Create the settings object - see default settings.js file for other options
    const css = `${this.extensionPath}/theme/main.css`;
    const favicon = `${this.extensionPath}/theme/favicon.ico`;
    const userDir = `${this.pwd}/workspace/${project.slug}/src`;
    const uiPort = await getPort({ port: getPort.makeRange(1880, 1980) });
    const settings = {
      functionGlobalContext: {
        env: {
          MONGODB_URI: process.env.MONGODB_URI,
          RABBITMQ_URI: process.env.RABBITMQ_URI,
          DEBUG: process.env.DEBUG,
          DEBUG_PWD: process.env.DEBUG_PWD,
          PWD: process.env.PWD,
          GRAPH_NODE_ID: process.env.GRAPH_NODE_ID,
          NODE_ENV: process.env.NODE_ENV,
          BUILD_ID: process.env.BUILD_ID
        }
      },    // enables global context
      flowFile: `${userDir}/flows.json`,
      userDir,
      editorTheme: {
        header: {
          title: project.name,
          image: null, // or null to remove image
          url: null // optional url to make the header text/image a link to this url
        },
        page: {
          title: 'Aitheon Graph App',
          favicon,
          css
        },
        menu: { // Hide unwanted menu items by id. see packages/node_modules/@node-red/editor-client/src/js/red.js:loadEditor for complete list
          "menu-item-help": false,
          "menu-item-node-red-version": false
        },
      },
      uiPort
    };
    const settingsFolder = `${this.pwd}/.local/share/graph-apps`;
    const settingsPath = `${settingsFolder}/${project._id}.js`;

    await ensureDir(settingsFolder);
    await writeFile(settingsPath, `module.exports = ${JSON.stringify(settings, undefined, 2)}`);

    const redProcess = await this.startProcess(userDir, settingsPath);

    return {
      uiPort,
      redProcess
    };
  }

  private async startProcess(userDir: string, settingsPath: string, safe = false, disableSafe = false) {
    const processPath = `${this.extensionPath}/node_modules/@aitheon/apps/red`;
    const redProcess = spawn(`${this.extensionPath}/start-node-red.sh`, [processPath, userDir, settingsPath, safe ? '--safe' : '']);
    redProcess.stdout.on('data', (data) => {
      console.log(`[Aitheon-Apps]: ${data}`);
    });
    redProcess.stderr.on('data', (data) => {
      console.error(`[Aitheon-Apps]: ${data}`);
    });
    redProcess.on('close', async (code) => {
      console.log(`[Aitheon-Apps] closed. code ${code}`);
      if ((safe && !disableSafe) || (code === 0)) { return; }
    
      if(!disableSafe) {
        console.log(`[Aitheon-Apps]: Starting in safe mode`);
        await this.startProcess(userDir, settingsPath, true);
      }
   
    });
    redProcess.on('exit', (code, signal) => {
      console.log(`[Aitheon-Apps] exited with code ${code} and signal ${signal}`);
    });
    return redProcess;
  }


  public async startForAppComponent(project: Project, port?: number) {
    const css = `${this.extensionPath}/theme/main.css`;
    const favicon = `${this.extensionPath}/theme/favicon.ico`;
    const appComponentPath = `${this.pwd}/.local/share/app-component/${project.slug}`;
    const flowsPath = `${appComponentPath}/flows.json`;
    const uiPort = port || await getPort({ port: getPort.makeRange(1880, 1980) });
    await ensureDir(appComponentPath);


    const settings = {
      functionGlobalContext: {
        env: {
          MONGODB_URI: process.env.MONGODB_URI,
          RABBITMQ_URI: process.env.RABBITMQ_URI,
          DEBUG: process.env.DEBUG,
          DEBUG_PWD: process.env.DEBUG_PWD,
          PWD: process.env.PWD,
          GRAPH_NODE_ID: process.env.GRAPH_NODE_ID,
          NODE_ENV: process.env.NODE_ENV,
          BUILD_ID: process.env.BUILD_ID
        }
      },    // enables global context
      flowFile: flowsPath,
      userDir: appComponentPath,
      editorTheme: {
        header: {
          title: 'App Component',
          image: null, // or null to remove image
          url: null // optional url to make the header text/image a link to this url
        },
        page: {
          title: 'Aitheon App Component',
          favicon,
          css
        },
        menu: { // Hide unwanted menu items by id. see packages/node_modules/@node-red/editor-client/src/js/red.js:loadEditor for complete list
          "menu-item-help": false,
          "menu-item-node-red-version": false
        },
      },
      uiPort
    };
    const settingsFolder = `${this.pwd}/.local/share/app-component/${project.slug}/settings`;
    const settingsPath = `${settingsFolder}/settings.js`;
    await ensureDir(settingsFolder);
    await writeFile(settingsPath, `module.exports = ${JSON.stringify(settings, undefined, 2)}`);
    const projectPath = `${this.pwd}/workspace/${project.slug}`;
    await this.componentCompiler.compile(appComponentPath, projectPath, this.extensionPath, project );

    return { nodeRedProcess: await this.startProcess(appComponentPath, settingsPath, false, true), uiPort };
  }

}
