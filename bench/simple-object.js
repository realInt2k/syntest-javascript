(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? factory(exports)
    : typeof define === "function" && define.amd
    ? define(["exports"], factory)
    : ((global =
        typeof globalThis !== "undefined" ? globalThis : global || self),
      factory((global.jsyaml = {})));
})(this, function (exports) {
    "use strict";

    function f(a, b, c) {
        return a + b + c * 2;
    }
    function ex(obj) {
        obj.deuce = {
            a: 10,
            b: 20
        }
        obj.num = 21 
        obj.func = f
        const x = {
            a: 1,
            b: 2,
            c: 3
        }
        return x.a + x.b + x.c;
    }
    function lmao(obj) {
        obj = obj ?? {} 
        const x = ex(obj)
        x.y = 100
    }

    const exprts = {
        ex1: ex,
        lmao: lmao
    }

    exports['default'] = exprts
    exports.ex1 = ex
    exports.lmao = lmao
})