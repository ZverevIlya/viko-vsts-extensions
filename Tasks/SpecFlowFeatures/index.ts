/// <reference path="../../definitions/restapi.d.ts" />

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');
import ents = require('html-entities');
import path = require('path');
import fs = require('fs');

import * as vm from 'vso-node-api';
import {ApiHelper} from 'vsts-specflow/apihelper';
import {Feature,Scenario,EntityIds,SuiteTestCases} from  'vsts-specflow/specflow';
import * as bi from 'vso-node-api/interfaces/BuildInterfaces';
import * as ci from 'vso-node-api/interfaces/CoreInterfaces';
import * as ti from 'vso-node-api/interfaces/TestInterfaces';
import * as wi from 'vso-node-api/interfaces/WorkItemTrackingInterfaces';

let rimraf = require('rimraf');

var features = {};



function addScenario(suite:string, entids: EntityIds,wi:wi.WorkItem) {
    if(features[suite]==undefined) features[suite] = new Feature(suite,entids);
    features[suite].addScenario(wi);
}

function storeFeature(name:string, feature:Feature) {
    let p1 = tl.getPathInput("destination");
    //make destination dir
    try {
        if(tl.getBoolInput("cleanDestination")) rimraf.sync(p1);
        fs.mkdirSync(p1);
    } catch(err) {
        if(err.code!='EEXIST') throw err; 
        console.log(err);
    }
    
    let filepath = path.join(p1,name+".feature");
    console.log("storing feature to:"+filepath);
    let contents = tl.loc("FeatureTemplate",name)+feature.toString();
    fs.writeFileSync(filepath,contents);
}

async function getProject(api:vm.WebApi) : Promise<ci.TeamProjectReference> {
    let projId =tl.getVariable("System.TeamProjectId"); 
    return await api.getCoreApi().getProject(projId);
}

async function run() {
    try {
        tl.setVariable('system.culture','ru-RU');
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        let apihelper = new ApiHelper();
        let api = apihelper.getApi();
        let project = await getProject(api);
        console.log(project);
        let suitePaths:string[] = tl.getInput("TestSuites").split(";");
        for(let sp of suitePaths) {
            console.log("Processing testcases for:"+sp);
            let suiteName = path.parse(sp).name;
            let testCases:SuiteTestCases = await apihelper.getTestCases(sp);
            let workItemsPromises = testCases.testcases.map(stc => stc.testCase).map(wir => api.getWorkItemTrackingApi().getWorkItem(Number.parseInt(wir.id)));
            for(let i=0;i<workItemsPromises.length;i++) addScenario(suiteName,testCases.entids, await workItemsPromises[i]); 
        }
        for(let name in features) storeFeature(name,features[name])
        console.log('Task done! ');
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
        console.log(err);
    }
}

tl.setVariable("System.TeamProjectId","40e8bc90-32fa-48f4-b43a-446f8ec3f084");
tl.setVariable("Build.BuildId","8205");
run().then(r => tl.setResult(tl.TaskResult.Succeeded,"Done"));
