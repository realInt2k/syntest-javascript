import * as parser from "@babel/parser";
import traverseModule from "@babel/traverse";
const traverse = traverseModule.default;
import * as t from "@babel/types";
import generatorModule from "@babel/generator";
const generate = generatorModule.default;
import fs from "fs";

function transformDestructuringAssignment (path) {
  const decls = path.node.declarations;

  const destructurings = decls.filter(d => t.isObjectPattern(d.id));
  if (destructurings.length === 0) return;

  const newDecls = [];

  for (const d of destructurings) {
    const rightExpr = d.init;
    if (!rightExpr) continue;

    for (const prop of d.id.properties) {
      if (!t.isIdentifier(prop.key)) continue;

      const keyName = prop.key.name;
      const aliasName = t.isIdentifier(prop.value)
        ? prop.value.name
        : keyName;

      newDecls.push(
        t.variableDeclaration("const", [
          t.variableDeclarator(
            t.identifier(aliasName),
            t.memberExpression(
              rightExpr,
              t.identifier(keyName)
            )
          ),
        ])
      );
    }
  }

  const raw = generate(path.node).code;
  const blockComment = `* ${raw.replace(/\*\//g, "*\\/")}`;
  path.addComment("leading", blockComment, false); // false → block comment

  path.insertAfter(newDecls);
  path.remove();
}

function transformObjectAssignment(path) {
  for (const decl of path.node.declarations) {
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
}

export function transform(source, output = null) {
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["jsx"],
  });

  traverse(ast, {
    VariableDeclaration(path) {
      transformObjectAssignment(path)
      transformDestructuringAssignment(path)
    },
    AssignmentExpression(path) {
      if (t.isObjectExpression(path.node.right)) {
        const { left, right } = path.node;

        if (t.isMemberExpression(left)) {
          const newStatements = [];

          for (const prop of right.properties) {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              newStatements.push(
                t.expressionStatement(
                  t.assignmentExpression(
                    "=",
                    t.memberExpression(left, t.identifier(prop.key.name)),
                    prop.value
                  )
                )
              );
            }
          }
          if (path.parentPath.isExpressionStatement()) {
            path.parentPath.insertAfter(newStatements);
          }
        }
      }
    }
  });

  const { code } = generate(ast, { retainLines: true });
  if (output !== null) {
    fs.writeFileSync(output, code, "utf8", (err) => {
      if (err) {
        console.error("Error writing file:", err);
        return;
      }
    });
  }
  return code;
}
