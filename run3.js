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
const SYNTAX_FROGIVING = true;
const typeExtractor = new TypeExtractor(SYNTAX_FROGIVING); // syntaxForgiving??

// const fileNames = ["bench/fxp.js", "bench/pako.js", "bench/js-yaml.js"];
const fileNames = ["bench/newthing.js"];
const allTypeValues = Object.values(TypeEnum);
setupLogger("", [], "debug");

function getAllNewRelationship(relationshipMap) {
  return Array.from(relationshipMap.entries())
  .filter(([key, value]) => {
    const rel = value.type || "";
    return rel === "new L()"
  })
  .map(([key]) => key);
}

function plotSchema(fileName) {
  const filePath = "";
  const source = transform(fs.readFileSync(fileName, "utf8"), fileName + "_transformed.js");
  const lines = source.split(/\r?\n/);
  const exportFactory = new ExportFactory(SYNTAX_FROGIVING);
  // Get ast
  const generator = new AbstractSyntaxTreeFactory();
  const result = generator.convert(filePath, source);
  const astUnwrapped = unwrap(result);
  // Get exported functions
  // libraries/analysis-javascript/lib/target/export/ExportFactory.ts
  const exportResult = exportFactory.extract(filePath, astUnwrapped);
  const exportedFunctions = exportResult.result;
  // get elements & relations
  const elementsResult = typeExtractor.extractElements(filePath, astUnwrapped);
  const relationsResult = typeExtractor.extractRelations(
    filePath,
    astUnwrapped
  );

  const allNewRelationship = getAllNewRelationship(relationsResult.result)
  allNewRelationship.forEach((id, i) => {
    const relNode = relationsResult.result.get(id)
    const lhsId = relNode.involved[0]

  })

  // get Type Model
  const typeResolver = new InferenceTypeModelFactory();
  const typeModel = typeResolver.resolveTypes(
    elementsResult.result,
    relationsResult.result
  );

  globalThis.relationsResult = relationsResult
  globalThis.elementsResult = elementsResult
  globalThis.typeModel = typeModel

  let concern = {};

  typeModel.typeNodes.forEach((value, key, map) => {
    try {
      value.getTypeProbabilities();
    } catch (e) {
      console.log("It's ", value.id, " that fails")
      exit(0);
    }
    value.firstLineAffected = lines[value.startLine - 1];
    value.sourceCode = source.slice(value.startIndex, value.endIndex);
    concern[key] = {
      line: value.firstLineAffected,
      src: value.sourceCode,
      probabilities: Object.fromEntries(value.getTypeProbabilities()),
    };
  });

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

  function capitalizeObjectKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
        return [capitalizedKey, value];
      })
    );
  }

  function removeEmptyObjFields(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== 0)
    )
  }

  function mergeObjectShapes(shapes) {
    const merged = {};

    for (const shape of shapes) {
      for (const [key, value] of Object.entries(shape)) {
        if (!merged[key]) {
          merged[key] = JSON.parse(JSON.stringify(value)); 
        } else {
          const kindMap = merged[key].kind || {};
          const newKind = value.kind || {};
          for (const [k, v] of Object.entries(newKind)) {
            kindMap[k] = (kindMap[k] || 0) + v;
          }
          merged[key].kind = kindMap;

          if (value.objectShape && value.objectShape.length > 0) {
            const deepObjShape = mergeObjectShapes([
              ...(merged[key].objectShape || []),
              ...value.objectShape,
            ]);
            merged[key].objectShape = deepObjShape
          }
          merged[key].arrayValueType = value.arrayValueType ?? {
            "isAny": true,
            "kind": {}
          }
        }
      }
    }

    // Normalize kinds
    for (const key in merged) {
      const kind = merged[key].kind;
      const total = Object.values(kind).reduce((a, b) => a + b, 0);
      for (const k in kind) {
        kind[k] = kind[k] / total;
      }
    }

    return merged;
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
    let couldBeArray = false;
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

      if (type.includes("array")) {
        couldBeArray = true;
      }
      hasType = true;
    }
    typesJson['number'] = typesJson['numeric'] + typesJson['integer']
    typesJson['numeric'] = 0
    typesJson['integer'] = 0
    if (hasType) {
      typesJson = removeEmptyObjFields(typesJson)
      typesJson = capitalizeObjectKeys(typesJson)
    }
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
    const mergedObjShapes = objectType; // mergeObjectShapes(objectType)
    let result = {}
    result.isAny = !hasType
    result.kind = hasType ? typesJson : {}
    if (!isEmptyObject(mergedObjShapes)) {
      result.objectShape = mergedObjShapes
    }
    if (couldBeArray) {
      result.arrayValueType = {
        "isAny": true,
        "kind": {}
      }
    }
    return result
  }

  function mergeRet(ret) {
    if (!Array.isArray(ret)) {
      return ret;
    } 
    if (ret.length <= 1) {
      return ret[0];
    }

    const mergedKind = {};
    let totProbabilities = 0;

    for (const obj of ret) {
      for (const [key, value] of Object.entries(obj.kind)) {
        mergedKind[key] = (mergedKind[key] || 0) + value;
        totProbabilities += value;
      }
    }

    const normalizedKind = {};
    for (const [key, value] of Object.entries(mergedKind)) {
      normalizedKind[key] = value / totProbabilities;
    }

    return {
      isAny: false,
      kind: normalizedKind,
    };
  }

  function isEmptyObject(obj) {
    return Object.keys(obj).length === 0;
  }


  function getSchemaFromIds(ids = [], names = null) {
    let cnt = 0;
    let result = [];
    for (const i in ids) {
      const id = ids[i];
      const name = names ? names[i] : "not_specified";
      const schema = getSchemaFromId(id, name, idMap)
      if (!isEmptyObject(schema)) {
        result.push(schema)
      }
      cnt += 1;
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
          if (node.id == ':123:6:::123:33:::3259:3286') {
            console.log(exportedFunctions[index].id)
          }
          if (node.type != "L=R") {
            if (node.type == 'function L(R)') {
              exportedFunctions[index].probabilities = probs;
              exportedFunctions[index].root = fid
            } else {
              // save
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
          // console.log({match, key:key})  
          const [,startLine,startColumn,endLine,endColum,startIndex,endIndex,] = match;
          const id = `:${startLine}:${startColumn}:::${endLine}:${endColum}:::${startIndex}:${endIndex}`;
          const func = typeModel.getTypeNode(id).objectType;
          foundFunctionDeclaration = true;
          const retType = getSchemaFromIds([...func.return.values()])
          schemaJson[exportedFunctions[index]["name"]] = {
            id: id,
            callconv: "Free",
            args: getSchemaFromIds(
              [...func.parameters.values()],
              [...func.parameterNames.values()]
            ),
            ret: isEmptyObject(retType) ? {
              "isAny": true,
              "kind": {}
            } : mergeRet(retType),
          };
          break;
        }
      }
      if (!foundFunctionDeclaration) {
        // schemaJson[exportedFunctions[index]["name"]] = {}
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
}

// fs.writeFileSync("bench/fxp-bench.json", JSON.stringify(schemaJson, null, 2));

for (const name of fileNames) {
  plotSchema(name);
}

exit(0)