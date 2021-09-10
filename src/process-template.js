const fs = require('fs-extra');
const  mustache = require('mustache');


async function processTemplate() {
    console.log('---------------------Template Processor-----------');
    const [repoPath, templateFilePath] = process.argv;
    console.log(process.argv);
    const configFilePath = `${repoPath}/config.json`;
    let components = [];
    let templateFile;
    if(!fs.existsSync(configFilePath)) {
        process.exit(1);
    }else {
        templateFile = await fs.readJSON(configFilePath);
    }

    if(!fs.existsSync(templateFilePath)){
        console.error('template file not found', configFilePath);
        process.exit(1);
    }

   
    for(const component of components) {
        const componentJsonPath = `${component.path}/package.json`;
        if(!fs.existsSync(componentJson)){
            console.error(`Could not find package.json`,componentJsonPath);
            continue;
        }
        const componentJson = await fs.readJSON(componentJsonPath);

        
        // merge the package
        const {name, description, version} = componentJson;
        const generatedJson = mustache.render(templateFile,{name, description,version});
        console.log(generatedJson);
    }

}
processTemplate();