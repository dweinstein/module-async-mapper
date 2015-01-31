var esprima = require('esprima');
var jp = require('jsonpath');

module.exports = {

  dict: {
    callbackName: '(callback|cb|done|fn)',
    errorName: /^(e|er|err|error|fail)$/i
  },

  is_probably_async: function(fn) {
    var fnLine = fn.toString().split('\n').shift();
    if (!fnLine.match(this.dict.callbackName)) return;
    
    var names = this.argument_names(fn) || [];
    if (String(names[names.length - 1]).replace('_', '').match(new RegExp('^' + this.dict.callbackName + '$', 'i'))) {
      return true;
    }
  },

  guess_callback_scheme: function(fn) {

    var names = this.argument_names(fn) || [];
    var name = names.pop();
    var tree = esprima.parse('(' + fn.toString() + ')');

    if (!name.match(/[a-zA-Z_]/)) return null;
    
    var nodes = jp.query(tree, '$..*')
      .filter(function(x) { 
        return x && typeof x == "object" &&
          x.type == "CallExpression" &&
          x.callee &&
          x.callee.name == name
	});

    var arity = Math.max.apply(null, nodes.map(function(n) { return n.arguments.length || 0 }));

    var firstErrArg = false;

    nodes.forEach(function(node) {
      var args = node.arguments;
      if (args && args[0] && args[0].name && args[0].name.match(this.dict.errorName)) {
        firstErrArg = true; 
      }
    }, this);

    if (arity == 1 && !firstErrArg) {
      return 'simple';
    } else if (arity >= 2 || firstErrArg){
      return 'standard';
    } else {
      return null;
    }
  },

  is_probably_promise: function(fn) {
    return Boolean(fn.toString().match(/return new Promise/));
  },

  is_generator: function(fn) {

    if (!_engine_supports_generators) return;
    if (typeof fn != "function") return;
    if (fn.constructor.name != "GeneratorFunction") return;

    return true;
  },

  is_function: function(fn) {

    if (typeof fn != "function") return;
    if (fn.constructor.name != "Function") return;

    return true;
  },

  argument_names: function(fn) {

    var fnLine = fn.toString().split('\n').shift();
    if (fnLine.match(/{\s*$/)) fnLine += '}';

    var exp = '(' + fnLine + ')';

    try {
      var tree = esprima.parse(exp);
      var params = tree.body[0].expression.params.map(function(x) { return x.name });
    } catch(e) {}

    return params || [];
  },

  engine_supports_generators: function() {
    return _engine_supports_generators;
  }
}

try {
  eval("(function*(){})");
  var _engine_supports_generators = true;
} catch (e) {}