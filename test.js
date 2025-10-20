import * as parser from "@babel/parser";
import traverseModule from "@babel/traverse";
const traverse = traverseModule.default;
import * as t from "@babel/types";
import generatorModule from "@babel/generator";
const generate = generatorModule.default;
import fs from "fs";

const code = `
function Deflate$1(options) {
    this.options = common.assign(
      {
        level: Z_DEFAULT_COMPRESSION,
        method: Z_DEFLATED$1,
        chunkSize: 16384,
        windowBits: 15,
        memLevel: 8,
        strategy: Z_DEFAULT_STRATEGY
      },
      options || {}
    );
    this.err = 0; 
    this.msg = ""; // error message
    this.ended = false; // used to avoid multiple onEnd() calls
    this.chunks = []; // chunks of compressed data

    this.strm = new zstream();
    this.strm.avail_out = 0;
}

function deflate$1(input, options) {
    const deflator = new Deflate$1(options);

    deflator.push(input, true);

    // That will never happens, if you don't cheat with options :)
    if (deflator.err) {
      throw deflator.msg || messages[deflator.err];
    }

    return deflator.result;
  }

var Deflate_1$1 = Deflate$1;
var deflate_2 = deflate$1;

var deflate_1$1 = {
    Deflate: Deflate_1$1,
    deflate: deflate_2,
  };

const { Deflate, deflate } = deflate_1$1;
var Deflate_1 = Deflate;
exports.Deflate = Deflate_1;
`;

const ast = parser.parse(code, { sourceType: "module" });

traverse(ast, {
  VariableDeclaration(path) {
    const decls = path.node.declarations;

    // Filter destructuring declarations
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

    // Add a comment for the old destructuring
    const raw = generate(path.node).code;
    const blockComment = `* ${raw.replace(/\*\//g, "*\\/")}`;
    path.addComment("leading", blockComment, false); // false → block comment

    path.insertAfter(newDecls);
    path.remove();
  },
});

const output = generate(ast, { comments: true }).code;
console.log(output);