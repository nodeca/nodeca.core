// Wrapper plugin, wrap asset source using `.wrapBefore` and `.wrapAfter`
//
'use strict';


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

  let enable_maps = context.bundler.sourceMaps;
  let source = context.asset.source;
  let old_map = context.asset.sourceMap;

  context.asset.source = [ before, source, after ].join('');

  if (enable_maps) {
    context.asset.sourceMap = {
      version: 3,
      sections: [ {
        offset: {
          line: (before.match(/\n/g) || []).length,
          column: before.match(/[^\n]*$/)[0].length
        },
        map: old_map || {
          version: 3,
          sources: [ context.asset.sourceMapPath ],
          sourcesContent: [ source ],
          mappings: 'AAAA;' + 'AACA;'.repeat(
            (source.match(/\n/g) || []).length +
            (source.endsWith('\n') ? 0 : 1) - 1
          )
        }
      } ]
    };
  }
};
