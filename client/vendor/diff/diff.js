
'use strict';

const _     = require('lodash');
const Diff  = require('diff').Diff;


let wordDiffFn = null;

// Temporary patch for jsdiff, trying to fix its handling of whitespace.
//
// This is exact copy of word differ from here:
// https://github.com/kpdecker/jsdiff/blob/master/src/diff/word.js
//
// Only difference is: /(\s|\b)/ regexp in tokenizer instead of /(\s+|\b)/,
// which allows to show inserted/removed empty lines better
//
// Example: diff('foo\nbar', 'foo\n\n\nbar')
//
// Original shows diff: [ 'foo', removed: '\n', added: '\n\n\n', 'bar' ]
// This version shows:  [ 'foo', added: '\n\n', 'bar' ]
//
/* eslint-disable max-len */
function diffWordsWithSpace(oldStr, newStr, options) {
  if (wordDiffFn) return wordDiffFn(oldStr, newStr, options);

  const extendedWordChars = /^[a-zA-Z\u{C0}-\u{FF}\u{D8}-\u{F6}\u{F8}-\u{2C6}\u{2C8}-\u{2D7}\u{2DE}-\u{2FF}\u{1E00}-\u{1EFF}]+$/u;
  const reWhitespace = /\S/;
  const wordDiff = new Diff();

  wordDiff.equals = function (left, right) {
    if (this.options.ignoreCase) {
      left = left.toLowerCase();
      right = right.toLowerCase();
    }
    return left === right || (this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right));
  };

  wordDiff.tokenize = function (value) {
    // Original code had \s+ instead of \s here
    let tokens = value.split(/(\s|\b)/);

    // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.
    for (let i = 0; i < tokens.length - 1; i++) {
      // If we have an empty string in the next field and we have only word chars before and after, merge
      if (!tokens[i + 1] && tokens[i + 2]
            && extendedWordChars.test(tokens[i])
            && extendedWordChars.test(tokens[i + 2])) {
        tokens[i] += tokens[i + 2];
        tokens.splice(i + 1, 2);
        i--;
      }
    }

    return tokens;
  };

  wordDiffFn = function diffWordsWithSpace(oldStr, newStr, options) {
    return wordDiff.diff(oldStr, newStr, options);
  };

  return wordDiffFn(oldStr, newStr, options);
}
/* eslint-enable max-len */


function diff_line(str1, str2) {
  let tokens = diffWordsWithSpace(str1 || '', str2 || '');
  let result = '';

  tokens.forEach(token => {
    if (token.added) {
      result += '<ins>' + _.escape(token.value) + '</ins>';
    } else if (token.removed) {
      result += '<del>' + _.escape(token.value) + '</del>';
    } else {
      result += _.escape(token.value);
    }
  });

  return '<div class="diff-line">' + result + '</div>';
}


function diff(str1, str2) {
  let tokens = diffWordsWithSpace(str1 || '', str2 || '');
  let result = '';
  let is_inline = false;

  tokens.forEach(token => {
    let lines = token.value.match(/^.*$\n?/mg);

    if (lines[lines.length - 1] === '') lines.pop();

    lines.forEach(line => {
      if (!is_inline && line[line.length - 1] === '\n') {
        if (token.added) {
          result += '<div class="diff-line diff-line-ins">' + _.escape(line.replace(/\n$/, '')) + '</div>';
        } else if (token.removed) {
          result += '<div class="diff-line diff-line-del">' + _.escape(line.replace(/\n$/, '')) + '</div>';
        } else {
          result += '<div class="diff-line">' + _.escape(line.replace(/\n$/, '')) + '</div>';
        }
      } else {
        if (!is_inline) {
          result += '<div class="diff-line">';
          is_inline = true;
        }

        if (token.added) {
          result += '<ins>' + _.escape(line) + '</ins>';
        } else if (token.removed) {
          result += '<del>' + _.escape(line) + '</del>';
        } else {
          result += _.escape(line);
        }
      }

      if (line[line.length - 1] === '\n') {
        if (is_inline) result += '</div>';
        is_inline = false;
      }
    });
  });

  if (is_inline) result += '</div>';

  return result;
}


module.exports.diff = diff;
module.exports.diff_line = diff_line;
