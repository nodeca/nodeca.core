'use strict';


const assert = require('assert');
const $      = require('nodeca.core/lib/parser/cheequery');


describe('cheequery', function () {

  it('should escape <>" characters from input', function () {
    assert.equal($.parse('<div>&lt;&gt;&amp;&quot;</div>').find('div').text(), '<>&"');
    assert.equal($.parse('<div>&lt;&gt;&amp;&quot;</div>').html(), '<div>&lt;&gt;&amp;&quot;</div>');
  });

  it('should escape <>" characters set as text/attributes', function () {
    let elements = $.parse('<div></div>');
    elements.find('div').text('<>&"');
    elements.find('div').attr('test', '<>&"');
    assert.equal(elements.html(), '<div test="&lt;&gt;&amp;&quot;">&lt;&gt;&amp;&quot;</div>');
  });

  it('should not escape astral characters from input', function () {
    assert.equal($.parse('<div>𐌀𐌁&#x10300;&#x10301;</div>').find('div').text(), '𐌀𐌁𐌀𐌁');
    assert.equal($.parse('<div>𐌀𐌁&#x10300;&#x10301;</div>').html(), '<div>𐌀𐌁𐌀𐌁</div>');
  });

  it('should not escape astral characters set as text/attributes', function () {
    let elements = $.parse('<div></div>');
    elements.find('div').text('𐌀𐌁');
    elements.find('div').attr('test', '𐌀𐌁');
    assert.equal(elements.html(), '<div test="𐌀𐌁">𐌀𐌁</div>');
  });

  it('should not escape cyrillic characters', function () {
    assert.equal($.parse('<div test=тест>тест</div>').find('div').text(), 'тест');
    assert.equal($.parse('<div test=тест>тест</div>').find('div').attr('test'), 'тест');
    assert.equal($.parse('<div test=тест>тест</div>').html(), '<div test="тест">тест</div>');
  });

  it('should unescape entities in input', function () {
    assert.equal($.parse('<div>&#x61;&#97;&mdash;&#x444;&#1092;</div>').html(), '<div>aa—фф</div>');
  });

});
