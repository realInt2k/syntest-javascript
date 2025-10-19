import * as parser from "@babel/parser";
import traverseModule from "@babel/traverse";
const traverse = traverseModule.default;
const stateParams = [];

function formatNodeLocation(node) {
  const { start, end, loc } = node;

  const row0 = loc.start.line;
  const col0 = loc.start.column;
  const row1 = loc.end.line;
  const col1 = loc.end.column;
  const startIndex = start;
  const endIndex = end;

  return `:${row0}:${col0}:::${row1}:${col1}:::${startIndex}:${endIndex}`;
}

function getFunctionName(path) {
  const { node, parent } = path;
  if (node.id) return node.id.name; // function foo() {}
  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier")
    return parent.id.name; // const foo = function() {}
  if (
    parent.type === "AssignmentExpression" &&
    parent.left.type === "Identifier"
  )
    return parent.left.name; // foo = function() {}
  if (parent.key && parent.key.name) return parent.key.name; // obj.foo = function() {}
  return "(anonymous)";
}

function getCodeLocation(node, source) {
  const { start, end, loc } = node;
  return source.slice(start, end);
}

const getFuncArgId = (source, funcName, argName) => {
  let argIndResult = null;
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  traverse(ast, {
    Function(path) {
      for (const param of path.node.params) {
        if (argName === param.name) {
          console.log("found something", getFunctionName(path));
        }
        if (
          param.type === "Identifier" &&
          param.name === argName &&
          argIndResult == null &&
          getFunctionName(path) == funcName
        ) {
          argIndResult = formatNodeLocation(param);
        }
      }
    },
  });
  return argIndResult;
};

export { getFuncArgId };

const getStateParams = (source) => {
  let stateParams = [];
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  traverse(ast, {
    Function(path) {
      for (const param of path.node.params) {
        if (param.type === "Identifier" && param.name === "state") {
          stateParams.push({
            param: formatNodeLocation(param),
            function: formatNodeLocation(path.node),
            functionCode: getCodeLocation(path.node, source),
          });
        }
        // Handle destructured: function foo({ state }) {}
        if (param.type === "ObjectPattern") {
          for (const p of param.properties) {
            if (p.key?.name === "state") stateParams.push(p);
          }
        }
      }
    },
  });
  return stateParams;
};
export { getStateParams };

export function getAllExports(source) {
  let result = [];
  const ast = parser.parse(source, {
    sourceType: "module", // allows ESM syntax
    plugins: ["jsx", "typescript"], // optional, in case of TS/JSX
  });

  traverse(ast, {
    // --- ES MODULE EXPORTS ---
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (decl) {
        if (decl.type === "FunctionDeclaration" && decl.id) {
          console.log("Named export:", decl.id.name);
        } else if (decl.type === "VariableDeclaration") {
          for (const d of decl.declarations) {
            if (d.id.type === "Identifier") {
              result.push(d.id.name);
            }
          }
        }
      } else if (path.node.specifiers.length > 0) {
        for (const spec of path.node.specifiers) {
          result.push(spec.exported.name);
        }
      }
    },

    ExportDefaultDeclaration(path) {
      const decl = path.node.declaration;
      if (decl.id) result.push(decl.id.name);
      // else console.log("Default export: (anonymous)");
    },

    // --- COMMONJS EXPORTS ---
    AssignmentExpression(path) {
      const left = path.node.left;

      if (left.type === "MemberExpression") {
        const obj = left.object;
        const prop = left.property;

        // exports.foo = ...
        if (obj.type === "Identifier" && obj.name === "exports") {
          result.push({
            name: prop.name,
            id: formatNodeLocation(path.node),
          });
        }

        // module.exports.foo = ...
        else if (
          obj.type === "MemberExpression" &&
          obj.object.name === "module" &&
          obj.property.name === "exports"
        ) {
          result.push({
            name: prop.name,
            id: formatNodeLocation(path.node),
          });
        }
      }
    },
  });
  return result;
}
