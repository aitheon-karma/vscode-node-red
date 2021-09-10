"use strict";
import { ensureDir, writeJson, writeFile, pathExists, ensureDirSync, writeJSON, copyFile, readJSON, readFile, copy, remove } from "fs-extra";
import { render } from 'mustache';
import { spawn, fork, exec, execSync } from 'child_process';
import { existsSync, fstat } from "fs";
import { Project } from "./project";
import crc from './shared/crc';
export class ComponentCompiler{

    constructor() {

    }

    async compile(compilePath: string, projectPath: string, extensionPath: string, project: Project) {
      
        const result = await this.processFiles(compilePath,projectPath, extensionPath);
        await this.installPackages(compilePath);

        // compiling ui files
        for (const component of result.configFile.components) {
          if(component.UIenabled && component.ui) {
             const uiPath = `${component.path}/${component.ui}`;
             await this.processUiFiles(uiPath, compilePath,component.name, project);
          }
        }
      }


     private async installPackages(compilePath: string) {
        console.info('Compiling packages...');
        if(!existsSync(`${compilePath}/package-lock.json`) || !existsSync(`${compilePath}/node_modules`)) {
          await this.installNpmPackage(compilePath, null);
        } 
        await this.installNpmPackage(compilePath, `${compilePath}/bin`); 
     }


     private async processUiFiles(vuePath: string, compilePath: string, componentName: string, project: Project) {
      const fullVuePath = `bin/${vuePath}`;
      try {
        const generatedName = await this.compileVueFile(fullVuePath, `${compilePath}`, componentName, project);
        const generatedMinFileName = `${generatedName}.min.js`;
        await ensureDir(`${compilePath}/bin/public`);
        await copyFile(`${compilePath}/bin/tmp/${generatedMinFileName}`,`${compilePath}/bin/public/${generatedMinFileName}`); 
        console.info('Compile success', componentName);
      }catch(err) {
        console.error(err);
      }
     }

     private async compileVueFile(vuePath: string, compilePath: string, componentName: string, project: Project) {
        return new Promise((resolve, reject) => {
         const name = `wc_${project._id}-${crc(componentName)}`;
          const command = `cd ${compilePath} && npm run build-wc -- --target wc --name ${name} ${vuePath}  --dest bin/tmp`;
            exec(command,(error, stdout, stderr) => {
              if (error) {
                console.log(error);
                reject(`Could not compile vue file. ${componentName}`);
                return;
              }
              resolve(name);
            });

        });
     }

     private async processFiles(compilePath: string, projectPath: string, extensionPath: string) {
        const files = ['flows.json', '.npmrc', '.npmignore', 'vue.config.js', 'babel.config.js'];
    
        const [templateJson, configFile] = (await Promise.all([
          readFile(`${extensionPath}/component-template/package.json.mustache`),
          readJSON(`${projectPath}/src/config.json`)
        ]));
    
        const { packageName, packageVersion, packageDependencies, packageDescription, components } = configFile;
        const nodes: { [key: string]: string } = {};
        for (const component of components) {
          nodes[component.name] = `${component.path}/${component.js}`;
        }
        const generatedPackage = JSON.parse(render(templateJson.toString(), { name: packageName, description: packageDescription, version: (packageVersion || '1.0.0') }));
        const binFolderPackage = { ...generatedPackage, dependencies: {} };
        generatedPackage.name = generatedPackage.name + '-demo';
        binFolderPackage['node-red'] = {
          nodes: nodes
        };
    
        // copy src files
        await ensureDir(`${compilePath}/bin/src`);
    
        const copySrc = copy(`${projectPath}/src`, `${compilePath}/bin/src`);
        const writePackageTobinFolder = writeFile(`${compilePath}/bin/package.json`, JSON.stringify(binFolderPackage, undefined, 4));
    
        Object.keys(packageDependencies).forEach(key => binFolderPackage.dependencies[key] = packageDependencies[key]);
        const writeFiles = files.map(file => !existsSync(`${compilePath}/${file}`) ? copyFile(`${extensionPath}/component-template/${file}`, `${compilePath}/${file}`) : Promise.resolve());
        const writePackageJson = writeFile(`${compilePath}/package.json`, JSON.stringify(generatedPackage, undefined, 4));
        const copyNpmIgnore = copyFile(`${extensionPath}/component-template/.npmignore`, `${compilePath}/bin/.npmignore`);
       // const removePackedNpm = remove(`${destination}/bin/${packedNpmPackageName}`);
        await Promise.all([...writeFiles, writePackageJson, copySrc, writePackageTobinFolder, copyNpmIgnore]);
        return {packageName, configFile};
     }
    
    
     private installNpmPackage(installPath: string, npmPath: string | null): Promise<string> {
        return new Promise((resolve, reject) => {
          exec(`cd ${installPath} && npm install ${npmPath ? npmPath : ''} --silent --prefer-offline --no-audit`, (error, stdout, stderr) => {
            if (error) {
              console.log(error);
              reject(error);
              return;
            }
            if (stderr) {
              reject(stderr);
              return;
            }
            resolve(stdout);
          });
        });
      }


      
    
}