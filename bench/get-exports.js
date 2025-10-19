const parser = require("@babel/parser");
const traverseModule = require("@babel/traverse");
const traverse = traverseModule.default || traverseModule;
const fs = require("fs");

const fileName = "js-yaml-trans.js";
const source = fs.readFileSync(fileName, "utf8");

const code = `
export function load() {}
export const save = () => {};
export default function main() {}

function internal() {}
export { internal as helper };

exports.commonjs = function() {};
module.exports.legacy = function legacy() {};
`;

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
            console.log("Named export:", d.id.name);
          }
        }
      }
    } else if (path.node.specifiers.length > 0) {
      for (const spec of path.node.specifiers) {
        console.log("Named export:", spec.exported.name);
      }
    }
  },

  ExportDefaultDeclaration(path) {
    const decl = path.node.declaration;
    if (decl.id) console.log("Default export:", decl.id.name);
    else console.log("Default export: (anonymous)");
  },

  // --- COMMONJS EXPORTS ---
  AssignmentExpression(path) {
    const left = path.node.left;

    if (left.type === "MemberExpression") {
      const obj = left.object;
      const prop = left.property;

      // exports.foo = ...
      if (obj.type === "Identifier" && obj.name === "exports") {
        console.log("CommonJS export:", prop.name);
      }

      // module.exports.foo = ...
      else if (
        obj.type === "MemberExpression" &&
        obj.object.name === "module" &&
        obj.property.name === "exports"
      ) {
        console.log("CommonJS export:", prop.name);
      }
    }
  },
});
