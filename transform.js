import * as parser from "@babel/parser";
import traverseModule from "@babel/traverse";
const traverse = traverseModule.default;
import * as t from "@babel/types";
import generatorModule from "@babel/generator";
const generate = generatorModule.default;
import fs from "fs";

export function transform(source, output = null) {
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["jsx"],
  });

  traverse(ast, {
    VariableDeclaration(path) {
      for (const decl of path.node.declarations) {
        // ✅ Only check if the initializer is an object
        if (t.isObjectExpression(decl.init) && t.isIdentifier(decl.id)) {
          const varName = decl.id.name;
          const newStatements = [];

          for (const prop of decl.init.properties) {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              const key = prop.key.name;

              // Create: <varName>.<key> = <value>;
              const assignment = t.expressionStatement(
                t.assignmentExpression(
                  "=",
                  t.memberExpression(t.identifier(varName), t.identifier(key)),
                  prop.value
                )
              );

              newStatements.push(assignment);
            }
          }

          path.insertAfter(newStatements);
        }
      }
    },
  });

  const { code } = generate(ast, { retainLines: true });
  if (output !== null) {
    fs.writeFile(output, code, "utf8", (err) => {
      if (err) {
        console.error("Error writing file:", err);
        return;
      }
    });
  }
  return code;
}
