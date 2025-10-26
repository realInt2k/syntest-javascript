import { AbstractSyntaxTreeFactory } from "./libraries/analysis-javascript/dist/lib/ast/AbstractSyntaxTreeFactory.js";
import { TypeExtractor } from "./libraries/analysis-javascript/dist/lib/type/discovery/TypeExtractor.js";
import { unwrap } from "@syntest/diagnostics";
import { setupLogger } from "@syntest/logging";
import fs from "fs";
import { InferenceTypeModelFactory } from "./libraries/analysis-javascript/dist/lib/type/resolving/InferenceTypeModelFactory.js";
import { exit } from "process";
import { ExportFactory } from "./libraries/analysis-javascript/dist/lib/target/export/ExportFactory.js";
import { transform } from "./transform.js";
import { TypeEnum } from "./libraries/analysis-javascript/dist/lib/type/resolving/TypeEnum.js"
import {collectFileSources} from "./collect-js.js"
import {getAllFunctions} from "./ast-traverse.js"

const SYNTAX_FROGIVING = true;
const typeExtractor = new TypeExtractor(SYNTAX_FROGIVING);

const allTypeValues = Object.values(TypeEnum);
setupLogger("", [], "debug");

const allSources = collectFileSources("./bench/extension");
const filePath = ""
const source = transform(fs.readFileSync(fileName, "utf8"));
// const exportFactory = new ExportFactory(SYNTAX_FROGIVING);
// Get ast
const generator = new AbstractSyntaxTreeFactory();
const result = generator.convert(filePath, source);
const astUnwrapped = unwrap(result);
// Get exported functions
// const exportResult = exportFactory.extract(filePath, astUnwrapped);
// const exportedFunctions = exportResult.result;
// get elements & relations
const elementsResult = typeExtractor.extractElements(filePath, astUnwrapped);
const relationsResult = typeExtractor.extractRelations(
filePath,
astUnwrapped
);
// get Type Model
const typeResolver = new InferenceTypeModelFactory();
const typeModel = typeResolver.resolveTypes(
elementsResult.result,
relationsResult.result
);

globalThis.relationsResult = relationsResult
globalThis.elementsResult = elementsResult
globalThis.typeModel = typeModel


const reg = /^:(\d+):(\d+):::(\d+):(\d+):::(\d+):(\d+)(.*)$/;
const regType = /^:(\d+):(\d+):::(\d+):(\d+):::(\d+):(\d+)<>(.*)$/;

let schemaJson = {};
let idMap = new Map()
let objIdMap = new Map()

function getTypeFromOriginalType(type) {
for (const t of allTypeValues) {
    if (type.includes(t)) {
    return t;
    }
}
return type
}

/** return a json like mapping of name => type */
function getObjectSchema(id) {
if (objIdMap.get(id)) {
    return {}
} else {
    objIdMap.set(id, true)
}
let objSchema = {}
const node = typeModel.getTypeNode(id)
const objProperties = node._objectType.properties
objProperties.entries().forEach(entry => {
    objSchema[entry[0]] = getSchemaFromId(entry[1], entry[0])
})
return objSchema
}

function getSchemaFromId(id, name) {
if (idMap.get(id)) {
    return {}
} else {
    idMap.set(id, true)
}
const node = typeModel.getTypeNode(id);
const typeProbs = node.getTypeProbabilities();
const types = [...typeProbs.keys()];
let typesJson = Object.fromEntries(allTypeValues.map(type => [type, 0]))
let originalKindJson = {};
let objectType = [] 
let hasType = false;
let couldBeObject = false;
let concreteObject = false;
for (const type of types) {
    const t = getTypeFromOriginalType(type);
    typesJson[t] += typeProbs.get(type);
    originalKindJson[type] = typeProbs.get(type);
    if (type.includes("object")) {
    if (type !== "object") {
        // It is equivalent of something other object
        const [,startRow,startCol,endRow,endCol,startInd,endInd,,] = type.match(reg)
        objectType.push(getObjectSchema(`:${startRow}:${startCol}:::${endRow}:${endCol}:::${startInd}:${endInd}`))
    } else {
        concreteObject = true
    }
    couldBeObject = true;
    }
    hasType = true;
}
typesJson = Object.fromEntries(
    Object.entries(typesJson).filter(([_, value]) => value !== 0)
)
if (concreteObject) {
    objectType.push(getObjectSchema(id));
    // let cntObjectProperties = 0;
    // const objProperties = node._objectType.properties
    // objProperties.entries().forEach(entry => {
    //   console.log("GOING INTO: ", entry)
    //   objectType.push(getSchemaFromId(entry[1], entry[0]))
    //   cntObjectProperties += 1
    // })
    // if (cntObjectProperties == 1) {
    //   objectType = objectType[0]
    // }
}
objectType = objectType.filter(obj => Object.keys(obj).length !== 0);
return {
    id: id,
    originalKind: originalKindJson,
    name: name,
    isAny: !hasType,
    kind: hasType ? typesJson : {},
    objectType: objectType
}
}

function getSchemaFromIds(ids = [], names = null) {
let cnt = 0;
let result = [];
for (const i in ids) {
    const id = ids[i];
    const name = names ? names[i] : "not_specified";
    
    result.push(getSchemaFromId(id, name, idMap))
    cnt += 1;
}
if (cnt === 1) {
    result = result[0];
}
return result;
}

for (const index in exportedFunctions) {
let fid = exportedFunctions[index].id;
if (fid === undefined) {
    continue;
} else {
    let node = false;
    let targetID = null;
    let targetProb = null;
    /** Trace back to the function */
    do {
    node = relationsResult.result.get(fid);
    if (node !== undefined) {
        const typeNode = typeModel.getTypeNode(fid);
        const probs = Object.fromEntries(typeNode.getTypeProbabilities());
        const line = lines[typeNode.startLine - 1];
        const code = source.slice(typeNode.startIndex, typeNode.endIndex);
        //   console.log(`fid - ${fid} - is relationship,
        // \n---relationship type:--- \n${node.type}
        // \n---probs:--- \n${JSON.stringify(probs, null, 2)},
        // \n---line:--- \n${line},
        // \n---code---: \n${code}`)
        if (node.type != "L=R") {
        if (node.type == 'function L(R)') {
            exportedFunctions[index].probabilities = probs;
            exportedFunctions[index].root = fid
        } else {
            exportedFunctions[index].probabilities = targetProb;
            exportedFunctions[index].root = targetID;
        }
        break;
        } else {
        // console.log("Found L=R, assigning")
        }
        fid = node.involved[1];
        targetID = fid;
        targetProb = probs;
    } else {
        node = elementsResult.result.get(fid);
        // console.log(`fid - ${fid} - is element, getting element's bindingId now`)
        if (node !== undefined) {
        fid = node.bindingId;
        } else {
        }
    }
    } while (node !== false && node !== undefined);

    let foundFunctionDeclaration = false;
    for (const key in exportedFunctions[index].probabilities) {
    if (key.includes("function")) {
        const match = key.match(reg) === null ? exportedFunctions[index].root.match(reg) : key.match(reg)
        console.log({match, key:key})
        const [,startLine,startColumn,endLine,endColum,startIndex,endIndex,] = match;
        const id = `:${startLine}:${startColumn}:::${endLine}:${endColum}:::${startIndex}:${endIndex}`;
        const func = typeModel.getTypeNode(id).objectType;
        foundFunctionDeclaration = true;
        // console.log("Found function declaration");
        // console.log({ id: id, func });
        // console.log("function ret: ", [...func.return.values()]);
        schemaJson[exportedFunctions[index]["name"]] = {
        id: id,
        callconv: "free",
        arg: getSchemaFromIds(
            [...func.parameters.values()],
            [...func.parameterNames.values()]
        ),
        ret: getSchemaFromIds([...func.return.values()]),
        };
        break;
    }
    }
    if (!foundFunctionDeclaration) {
    schemaJson[exportedFunctions[index]["name"]] = {}
    // console.log("No function declaration found");
    }
    // const typeNode = typeModel.getTypeNode(targetID);
    // const probs = Object.fromEntries(typeNode.getTypeProbabilities())
    // console.log(`target is: ${targetID}, props = ${JSON.stringify(probs, null, 2)}`)
}
}

fs.writeFileSync(
fileName + "-schema.json",
JSON.stringify(schemaJson, null, 2)
);

