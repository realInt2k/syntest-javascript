import { AbstractSyntaxTreeFactory } from "./libraries/analysis-javascript/dist/lib/ast/AbstractSyntaxTreeFactory.js";
import { TypeExtractor } from "./libraries/analysis-javascript/dist/lib/type/discovery/TypeExtractor.js";
import { unwrap } from "@syntest/diagnostics";
import { setupLogger } from "@syntest/logging";
import fs from "fs";
import { InferenceTypeModelFactory } from "./libraries/analysis-javascript/dist/lib/type/resolving/InferenceTypeModelFactory.js";
import { exit } from "process";
import { ExportFactory } from "./libraries/analysis-javascript/dist/lib/target/export/ExportFactory.js";
import { transform } from "./transform.js";
const SYNTAX_FROGIVING = true;
const typeExtractor = new TypeExtractor(SYNTAX_FROGIVING); // syntaxForgiving??

const fileNames = ["bench/fxp.js", "bench/pako.js", "bench/js-yaml.js"];

setupLogger("", [], "debug");

function plotSchema(fileName) {
  const source = fs.readFileSync(fileName, "utf8");
  const lines = source.split(/\r?\n/);
  const exportFactory = new ExportFactory(SYNTAX_FROGIVING);
  const filePath = "";
  const generator = new AbstractSyntaxTreeFactory();
  const result = generator.convert(filePath, source);
  const astUnwrapped = unwrap(result);

  const elementsResult = typeExtractor.extractElements(filePath, astUnwrapped);

  const relationsResult = typeExtractor.extractRelations(
    filePath,
    astUnwrapped
  );

  // libraries/analysis-javascript/lib/target/export/ExportFactory.ts
  const exportResult = exportFactory.extract(filePath, astUnwrapped);
  const exportedFunctions = exportResult.result;

  const typeResolver = new InferenceTypeModelFactory();

  const typeModel = typeResolver.resolveTypes(
    elementsResult.result,
    relationsResult.result
  );

  let concern = {};

  typeModel.typeNodes.forEach((value, key, map) => {
    value.getTypeProbabilities();
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

  function getSchemaFromIds(ids = [], names = null) {
    let cnt = 0;
    let result = [];
    for (const i in ids) {
      const id = ids[i];
      const name = names ? names[i] : "not_specified";
      const node = typeModel.getTypeNode(id);
      const typeProbs = node.getTypeProbabilities();
      const types = [...typeProbs.keys()];
      let typesJson = {};
      let originalKindJson = {};
      console.log({ types });
      for (const type of types) {
        try {
          const [, , , , , , , t, , ,] = type.match(regType);
          typesJson[t] = typeProbs.get(type);
        } catch (e) {
          typesJson[type] = typeProbs.get(type);
        }
        originalKindJson[type] = typeProbs.get(type);
        if (type.includes("object")) {
        }
      }
      result.push({
        id: id,
        originalKind: originalKindJson,
        name: name,
        isAny: false,
        kind: typesJson,
      });
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
            exportedFunctions[index].probabilities = targetProb;
            exportedFunctions[index].root = targetID;
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
          const match = key.match(reg);
          const [
            ,
            startLine,
            startColumn,
            endLine,
            endColum,
            startIndex,
            endIndex,
          ] = match;
          const id = `:${startLine}:${startColumn}:::${endLine}:${endColum}:::${startIndex}:${endIndex}`;
          const func = typeModel.getTypeNode(id).objectType;
          foundFunctionDeclaration = true;
          console.log("Found function declaration");
          console.log({ id: id, func });
          console.log("function ret: ", [...func.return.values()]);
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
        console.log("No function declaration found");
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
