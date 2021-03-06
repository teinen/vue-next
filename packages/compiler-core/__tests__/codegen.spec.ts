import {
  locStub,
  generate,
  NodeTypes,
  RootNode,
  createSimpleExpression,
  createObjectExpression,
  createObjectProperty,
  createArrayExpression,
  createCompoundExpression,
  createInterpolation,
  createSequenceExpression,
  createCallExpression,
  createConditionalExpression,
  IfCodegenNode,
  ForCodegenNode,
  createCacheExpression,
  createTemplateLiteral,
  createBlockStatement,
  createIfStatement,
  createAssignmentExpression
} from '../src'
import {
  CREATE_VNODE,
  TO_DISPLAY_STRING,
  RESOLVE_DIRECTIVE,
  helperNameMap,
  RESOLVE_COMPONENT,
  CREATE_COMMENT
} from '../src/runtimeHelpers'
import { createElementWithCodegen } from './testUtils'
import { PatchFlags } from '@vue/shared'

function createRoot(options: Partial<RootNode> = {}): RootNode {
  return {
    type: NodeTypes.ROOT,
    children: [],
    helpers: [],
    components: [],
    directives: [],
    imports: [],
    hoists: [],
    cached: 0,
    temps: 0,
    codegenNode: createSimpleExpression(`null`, false),
    loc: locStub,
    ...options
  }
}

describe('compiler: codegen', () => {
  test('module mode preamble', () => {
    const root = createRoot({
      helpers: [CREATE_VNODE, RESOLVE_DIRECTIVE]
    })
    const { code } = generate(root, { mode: 'module' })
    expect(code).toMatch(
      `import { ${helperNameMap[CREATE_VNODE]} as _${
        helperNameMap[CREATE_VNODE]
      }, ${helperNameMap[RESOLVE_DIRECTIVE]} as _${
        helperNameMap[RESOLVE_DIRECTIVE]
      } } from "vue"`
    )
    expect(code).toMatchSnapshot()
  })

  test('module mode preamble w/ optimizeBindings: true', () => {
    const root = createRoot({
      helpers: [CREATE_VNODE, RESOLVE_DIRECTIVE]
    })
    const { code } = generate(root, { mode: 'module', optimizeBindings: true })
    expect(code).toMatch(
      `import { ${helperNameMap[CREATE_VNODE]}, ${
        helperNameMap[RESOLVE_DIRECTIVE]
      } } from "vue"`
    )
    expect(code).toMatch(
      `const _${helperNameMap[CREATE_VNODE]} = ${
        helperNameMap[CREATE_VNODE]
      }, _${helperNameMap[RESOLVE_DIRECTIVE]} = ${
        helperNameMap[RESOLVE_DIRECTIVE]
      }`
    )
    expect(code).toMatchSnapshot()
  })

  test('function mode preamble', () => {
    const root = createRoot({
      helpers: [CREATE_VNODE, RESOLVE_DIRECTIVE]
    })
    const { code } = generate(root, { mode: 'function' })
    expect(code).toMatch(`const _Vue = Vue`)
    expect(code).toMatch(
      `const { ${helperNameMap[CREATE_VNODE]}: _${
        helperNameMap[CREATE_VNODE]
      }, ${helperNameMap[RESOLVE_DIRECTIVE]}: _${
        helperNameMap[RESOLVE_DIRECTIVE]
      } } = _Vue`
    )
    expect(code).toMatchSnapshot()
  })

  test('function mode preamble w/ prefixIdentifiers: true', () => {
    const root = createRoot({
      helpers: [CREATE_VNODE, RESOLVE_DIRECTIVE]
    })
    const { code } = generate(root, {
      mode: 'function',
      prefixIdentifiers: true
    })
    expect(code).not.toMatch(`const _Vue = Vue`)
    expect(code).toMatch(
      `const { ${helperNameMap[CREATE_VNODE]}: _${
        helperNameMap[CREATE_VNODE]
      }, ${helperNameMap[RESOLVE_DIRECTIVE]}: _${
        helperNameMap[RESOLVE_DIRECTIVE]
      } } = Vue`
    )
    expect(code).toMatchSnapshot()
  })

  test('assets', () => {
    const root = createRoot({
      components: [`Foo`, `bar-baz`, `barbaz`],
      directives: [`my_dir`]
    })
    const { code } = generate(root, { mode: 'function' })
    expect(code).toMatch(
      `const _component_Foo = _${helperNameMap[RESOLVE_COMPONENT]}("Foo")\n`
    )
    expect(code).toMatch(
      `const _component_bar_baz = _${
        helperNameMap[RESOLVE_COMPONENT]
      }("bar-baz")\n`
    )
    expect(code).toMatch(
      `const _component_barbaz = _${
        helperNameMap[RESOLVE_COMPONENT]
      }("barbaz")\n`
    )
    expect(code).toMatch(
      `const _directive_my_dir = _${
        helperNameMap[RESOLVE_DIRECTIVE]
      }("my_dir")\n`
    )
    expect(code).toMatchSnapshot()
  })

  test('hoists', () => {
    const root = createRoot({
      hoists: [
        createSimpleExpression(`hello`, false, locStub),
        createObjectExpression(
          [
            createObjectProperty(
              createSimpleExpression(`id`, true, locStub),
              createSimpleExpression(`foo`, true, locStub)
            )
          ],
          locStub
        )
      ]
    })
    const { code } = generate(root)
    expect(code).toMatch(`const _hoisted_1 = hello`)
    expect(code).toMatch(`const _hoisted_2 = { id: "foo" }`)
    expect(code).toMatchSnapshot()
  })

  test('temps', () => {
    const root = createRoot({
      temps: 3
    })
    const { code } = generate(root)
    expect(code).toMatch(`let _temp0, _temp1, _temp2`)
    expect(code).toMatchSnapshot()
  })

  test('prefixIdentifiers: true should inject _ctx statement', () => {
    const { code } = generate(createRoot(), { prefixIdentifiers: true })
    expect(code).toMatch(`const _ctx = this\n`)
    expect(code).toMatchSnapshot()
  })

  test('static text', () => {
    const { code } = generate(
      createRoot({
        codegenNode: {
          type: NodeTypes.TEXT,
          content: 'hello',
          loc: locStub
        }
      })
    )
    expect(code).toMatch(`return "hello"`)
    expect(code).toMatchSnapshot()
  })

  test('interpolation', () => {
    const { code } = generate(
      createRoot({
        codegenNode: createInterpolation(`hello`, locStub)
      })
    )
    expect(code).toMatch(`return _${helperNameMap[TO_DISPLAY_STRING]}(hello)`)
    expect(code).toMatchSnapshot()
  })

  test('comment', () => {
    const { code } = generate(
      createRoot({
        codegenNode: {
          type: NodeTypes.COMMENT,
          content: 'foo',
          loc: locStub
        }
      })
    )
    expect(code).toMatch(`return _${helperNameMap[CREATE_COMMENT]}("foo")`)
    expect(code).toMatchSnapshot()
  })

  test('compound expression', () => {
    const { code } = generate(
      createRoot({
        codegenNode: createCompoundExpression([
          `_ctx.`,
          createSimpleExpression(`foo`, false, locStub),
          ` + `,
          {
            type: NodeTypes.INTERPOLATION,
            loc: locStub,
            content: createSimpleExpression(`bar`, false, locStub)
          },
          // nested compound
          createCompoundExpression([` + `, `nested`])
        ])
      })
    )
    expect(code).toMatch(
      `return _ctx.foo + _${helperNameMap[TO_DISPLAY_STRING]}(bar) + nested`
    )
    expect(code).toMatchSnapshot()
  })

  test('ifNode', () => {
    const { code } = generate(
      createRoot({
        codegenNode: {
          type: NodeTypes.IF,
          loc: locStub,
          branches: [],
          codegenNode: createSequenceExpression([
            createSimpleExpression('foo', false),
            createSimpleExpression('bar', false)
          ]) as IfCodegenNode
        }
      })
    )
    expect(code).toMatch(`return (foo, bar)`)
    expect(code).toMatchSnapshot()
  })

  test('forNode', () => {
    const { code } = generate(
      createRoot({
        codegenNode: {
          type: NodeTypes.FOR,
          loc: locStub,
          source: createSimpleExpression('foo', false),
          valueAlias: undefined,
          keyAlias: undefined,
          objectIndexAlias: undefined,
          children: [],
          parseResult: {} as any,
          codegenNode: createSequenceExpression([
            createSimpleExpression('foo', false),
            createSimpleExpression('bar', false)
          ]) as ForCodegenNode
        }
      })
    )
    expect(code).toMatch(`return (foo, bar)`)
    expect(code).toMatchSnapshot()
  })

  test('Element (callExpression + objectExpression + TemplateChildNode[])', () => {
    const { code } = generate(
      createRoot({
        codegenNode: createElementWithCodegen([
          // string
          `"div"`,
          // ObjectExpression
          createObjectExpression(
            [
              createObjectProperty(
                createSimpleExpression(`id`, true, locStub),
                createSimpleExpression(`foo`, true, locStub)
              ),
              createObjectProperty(
                createSimpleExpression(`prop`, false, locStub),
                createSimpleExpression(`bar`, false, locStub)
              ),
              // compound expression as computed key
              createObjectProperty(
                {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  loc: locStub,
                  children: [
                    `foo + `,
                    createSimpleExpression(`bar`, false, locStub)
                  ]
                },
                createSimpleExpression(`bar`, false, locStub)
              )
            ],
            locStub
          ),
          // ChildNode[]
          [
            createElementWithCodegen([
              `"p"`,
              createObjectExpression(
                [
                  createObjectProperty(
                    // should quote the key!
                    createSimpleExpression(`some-key`, true, locStub),
                    createSimpleExpression(`foo`, true, locStub)
                  )
                ],
                locStub
              )
            ])
          ],
          // flag
          PatchFlags.FULL_PROPS + ''
        ])
      })
    )
    expect(code).toMatch(`
    return _${helperNameMap[CREATE_VNODE]}("div", {
      id: "foo",
      [prop]: bar,
      [foo + bar]: bar
    }, [
      _${helperNameMap[CREATE_VNODE]}("p", { "some-key": "foo" })
    ], ${PatchFlags.FULL_PROPS})`)
    expect(code).toMatchSnapshot()
  })

  test('ArrayExpression', () => {
    const { code } = generate(
      createRoot({
        codegenNode: createArrayExpression([
          createSimpleExpression(`foo`, false),
          createCallExpression(`bar`, [`baz`])
        ])
      })
    )
    expect(code).toMatch(`return [
      foo,
      bar(baz)
    ]`)
    expect(code).toMatchSnapshot()
  })

  test('SequenceExpression', () => {
    const { code } = generate(
      createRoot({
        codegenNode: createSequenceExpression([
          createSimpleExpression(`foo`, false),
          createCallExpression(`bar`, [`baz`])
        ])
      })
    )
    expect(code).toMatch(`return (foo, bar(baz))`)
    expect(code).toMatchSnapshot()
  })

  test('ConditionalExpression', () => {
    const { code } = generate(
      createRoot({
        codegenNode: createConditionalExpression(
          createSimpleExpression(`ok`, false),
          createCallExpression(`foo`),
          createConditionalExpression(
            createSimpleExpression(`orNot`, false),
            createCallExpression(`bar`),
            createCallExpression(`baz`)
          )
        )
      })
    )
    expect(code).toMatch(
      `return ok
      ? foo()
      : orNot
        ? bar()
        : baz()`
    )
    expect(code).toMatchSnapshot()
  })

  test('CacheExpression', () => {
    const { code } = generate(
      createRoot({
        cached: 1,
        codegenNode: createCacheExpression(
          1,
          createSimpleExpression(`foo`, false)
        )
      }),
      {
        mode: 'module',
        prefixIdentifiers: true
      }
    )
    expect(code).toMatch(`const _cache = _ctx.$cache`)
    expect(code).toMatch(`_cache[1] || (_cache[1] = foo)`)
    expect(code).toMatchSnapshot()
  })

  test('CacheExpression w/ isVNode: true', () => {
    const { code } = generate(
      createRoot({
        cached: 1,
        codegenNode: createCacheExpression(
          1,
          createSimpleExpression(`foo`, false),
          true
        )
      }),
      {
        mode: 'module',
        prefixIdentifiers: true
      }
    )
    expect(code).toMatch(`const _cache = _ctx.$cache`)
    expect(code).toMatch(
      `
  _cache[1] || (
    _setBlockTracking(-1),
    _cache[1] = foo,
    _setBlockTracking(1),
    _cache[1]
  )
    `.trim()
    )
    expect(code).toMatchSnapshot()
  })

  test('TemplateLiteral', () => {
    const { code } = generate(
      createRoot({
        codegenNode: createCallExpression(`_push`, [
          createTemplateLiteral([
            `foo`,
            createCallExpression(`_renderAttr`, ['id', 'foo']),
            `bar`
          ])
        ])
      }),
      { ssr: true, mode: 'module' }
    )
    expect(code).toMatchInlineSnapshot(`
      "
      export function ssrRender(_ctx, _push, _parent) {
        _push(\`foo\${_renderAttr(id, foo)}bar\`)
      }"
    `)
  })

  describe('IfStatement', () => {
    test('if', () => {
      const { code } = generate(
        createRoot({
          codegenNode: createBlockStatement([
            createIfStatement(
              createSimpleExpression('foo', false),
              createBlockStatement([createCallExpression(`ok`)])
            )
          ])
        }),
        { ssr: true, mode: 'module' }
      )
      expect(code).toMatchInlineSnapshot(`
        "
        export function ssrRender(_ctx, _push, _parent) {
          if (foo) {
            ok()
          }
        }"
      `)
    })

    test('if/else', () => {
      const { code } = generate(
        createRoot({
          codegenNode: createBlockStatement([
            createIfStatement(
              createSimpleExpression('foo', false),
              createBlockStatement([createCallExpression(`foo`)]),
              createBlockStatement([createCallExpression('bar')])
            )
          ])
        }),
        { ssr: true, mode: 'module' }
      )
      expect(code).toMatchInlineSnapshot(`
        "
        export function ssrRender(_ctx, _push, _parent) {
          if (foo) {
            foo()
          } else {
            bar()
          }
        }"
      `)
    })

    test('if/else-if', () => {
      const { code } = generate(
        createRoot({
          codegenNode: createBlockStatement([
            createIfStatement(
              createSimpleExpression('foo', false),
              createBlockStatement([createCallExpression(`foo`)]),
              createIfStatement(
                createSimpleExpression('bar', false),
                createBlockStatement([createCallExpression(`bar`)])
              )
            )
          ])
        }),
        { ssr: true, mode: 'module' }
      )
      expect(code).toMatchInlineSnapshot(`
        "
        export function ssrRender(_ctx, _push, _parent) {
          if (foo) {
            foo()
          } else if (bar) {
            bar()
          }
        }"
      `)
    })

    test('if/else-if/else', () => {
      const { code } = generate(
        createRoot({
          codegenNode: createBlockStatement([
            createIfStatement(
              createSimpleExpression('foo', false),
              createBlockStatement([createCallExpression(`foo`)]),
              createIfStatement(
                createSimpleExpression('bar', false),
                createBlockStatement([createCallExpression(`bar`)]),
                createBlockStatement([createCallExpression('baz')])
              )
            )
          ])
        }),
        { ssr: true, mode: 'module' }
      )
      expect(code).toMatchInlineSnapshot(`
        "
        export function ssrRender(_ctx, _push, _parent) {
          if (foo) {
            foo()
          } else if (bar) {
            bar()
          } else {
            baz()
          }
        }"
      `)
    })
  })

  test('AssignmentExpression', () => {
    const { code } = generate(
      createRoot({
        codegenNode: createAssignmentExpression(
          createSimpleExpression(`foo`, false),
          createSimpleExpression(`bar`, false)
        )
      })
    )
    expect(code).toMatchInlineSnapshot(`
      "
      return function render() {
        with (this) {
          return foo = bar
        }
      }"
    `)
  })
})
