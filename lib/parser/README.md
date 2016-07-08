# Parser

## API

### `.md2html(params)`

**params:**

- text (String) - text in markdown
- imports (Array) - list of urls user has access to (optional, rebuild mode)
- user_info (Object) - for permission checks (needed if `imports` is not present)
- attachments (Array) - list of attachment ids
- options (Object) - object with plugins config
  - links (Boolean)
  - images (Boolean)
  - ...
  
**result (Promise):**

- html (String) - displayed HTML
- text (String) - text for search index
- imports (Array) - list of urls used to create this post
- import_users (Array) - list of users needed to display this post
- tail (Array)
  - media_id (String)
  - file_name (String)
  - type (Number)

### `.md2preview(params)`

**params:**

- text (String) - text in markdown
- attachments (Array) - list of attachment ids
- link2text (Boolean) - replace links with spans
- limit (Number) - limit maximum text length

**result (Promise):**

- preview (String) - simplified HTML

## AST

### Tags

| Tag | View |
| --- | ---- |
| image | `<img src="{{src}}" alt="{{alt}}">` |
| link | `<msg-link href="{{url}}" data-nd-internal="{{true/false}}" data-nd-auto="{{true/false}}">{{text}}</msg-link>` |
| bullet list | `<ul><li>{{text}}</li></ul>` |
| numbered list | `<ol><li>{{text}}</li></ol>` |
| code block | `<msg-codeblock data-nd-lang="{{lang}}">{{text}}</msg-codeblock>` |
| code inline | `<code></code>` |
| heading | `<h1>{{text}}</h1>, ..., <h6>{{text}}</h6>` |
| bold | `<strong>{{text}}</strong>` |
| italic | `<em>{{text}}</em>` |
| strikethrough | `<s>{{text}}</s>` |
| spoiler | `<msg-spoiler data-nd-title="{{title}}">{{content}}</msg-spoiler>` |
| sup | `<sup>{{text}}</sup>` |
| sub | `<sub>{{text}}</sub>` |
| emoji | `<msg-emoji data-nd-name="{{name}}" data-nd-content="{{content}}"></msg-emoji>` |
| footnote | `<msg-footnote-ref data-nd-footnote-id="{{id}}" data-nd-footnote-sub-id="{{sub}}"></msg-footnote-ref>` + `<msg-footnote-data data-nd-footnote-id="{{id}}">{{content}}</msg-footnote-data>` |
| hr | `<hr>` |
| table | `<table class="table table-striped"><thead><tr><th>{{header}}</th></tr></thead><tbody><tr><td>{{text}}</td></tr></tbody></table>` |
| quote | `<msg-quote data-nd-title="{{title}}">{{content}}</msg-quote>` |

### AST -> preview

| Tag | View |
| --- | ---- |
| image | `<span class="icon icon-picture"></span>` |
| link | depends on `link2text` option: `<span class="preview-link"></span>` or same as HTML |
| bullet list | `<span class="icon icon-list-bullet"></span>` |
| numbered list | `<span class="icon icon-list-numbered"></span>` |
| code block | `<span class="icon icon-code"></span>` |
| sup | `^text` |
| footnote | remove |
| hr | remove |
| table | `<span class="icon icon-table"></span>` |
| quote | remove |

### AST -> HTML

| Tag | View |
| --- | ---- |
| code block | `<pre class="hljs"><code>{{highlighted_code}}</code></pre>` |
| spoiler | `<div class="spoiler">...</div>` |
| footnote | `<sup class="footnote-ref">...</sup>` + `<hr class="footnotes-sep"><section class="footnotes">...</section>` |
| quote | `<blockquote class="quote"><div class="quote__content">{{content}}</div></blockquote>` |


**Attachments**:

Not presented in AST, only in option `attachments`. Out in `tail` array.

**Links expand:**

Automatic links could be expanded to:

- forum posts quotes
- HTML snippets with [embedza](https://github.com/nodeca/embedza) (for external video players like Vimeo)
