// Wrapper plugin, wrap asset source using `.wrapBefore` and `.wrapAfter`
//
'use strict';

const SourceMap = require('fast-sourcemap-concat');


module.exports = async function (context) {
  // empty assets don't need wrapper
  if (!context.asset.source) return;

  let before = context.asset.wrapBefore, after = context.asset.wrapAfter;

  // no wrappers set
  if (!before && !after) return;

  // protect against source code inserted at the end of "//"-style comment
  if (!context.asset.source.endsWith('\n')) {
    after = '\n' + after;
  }

  if (context.bundler.sourceMaps) {
    let mapper = new SourceMap({ mapURL: 'unused', file: 'unused' });

    mapper.addSpace(before);
    mapper.addFileSource(
      context.asset.sourceMapPath,
      context.asset.source,
      context.asset.sourceMap
    );
    mapper.addSpace(after);

    let result = await mapper.end();
    context.asset.source = result.code.replace(/\/\/# sourceMappingURL=unused\n$/, '');

    delete result.map.file;
    context.asset.sourceMap = result.map;
  } else {
    let result = [];
    result.push(before);
    result.push(context.asset.source);
    result.push(after);
    context.asset.source = result.join('');
  }
};
