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
  deflate: deflate_2
};deflate_1$1.Deflate = Deflate_1$1;deflate_1$1.deflate = deflate_2; /** const {
  Deflate,
  deflate
} = deflate_1$1;*/const Deflate = deflate_1$1.Deflate;const deflate = deflate_1$1.deflate;
var Deflate_1 = Deflate;
var deflate_1 = deflate;

exports.Deflate = Deflate_1;
exports.deflate = deflate_1;