function f() {
    this.x = 10
    this.y = 11
    this.a = 'asdadasdasd'
}

function g() {
    this.x = 9
    this.y = 12
}

function foo(i) {
    if (i == 2) {
        return f
    } else {
        return g
    }
}

const e0 = new f()
const func = foo(2)
const e1 = new func()

exports.e0 = e0
exports.e1 = e1

// exit(0)