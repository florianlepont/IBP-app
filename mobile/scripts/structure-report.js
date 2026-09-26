#!/usr/bin/env node
// Structure report for the mobile app (phase 01.9, D-04 and D-06).
//
// Four scanners built on the installed TypeScript compiler API:
// - findUnusedStyleKeys: StyleSheet.create keys that no file reads.
// - findLongFiles: files over 400 lines under src/screens/ and src/navigation/.
// - findUserFacingLiterals: hard-coded user-facing strings outside src/i18n/.
// - findStatusIdLeaks: status messages built from ids or raw error text.
//
// Usage (paths are relative to mobile/, files or directories, default "src" and "App.tsx"):
//   node mobile/scripts/structure-report.js <unused-styles|long-files|literals|status-ids>
//     [paths...] [--max N] [--json]
// Prints "<check>: <count>" then one line per item. Exits 1 only when --max N is
// given and the count is above N.
//
// The Jest ratchet in src/__checks__/structure.test.ts runs the same functions.

const fs = require("fs")
const path = require("path")
const ts = require("typescript")

const MOBILE_ROOT = path.resolve(__dirname, "..")
// App.tsx sits outside src/ but reads the shared styles, so it is part of the default scope.
const DEFAULT_PATHS = ["src", "App.tsx"]
const SOURCE_EXTENSIONS = [".ts", ".tsx"]
const SKIPPED_DIRECTORIES = new Set(["node_modules", "__mocks__"])

const STATUS_FUNCTIONS = new Set(["setStatus", "onStatusChange", "reportStatus"])
const TEXT_PROPS = new Set([
  "title",
  "label",
  "placeholder",
  "accessibilityLabel",
  "accessibilityHint",
  "subtitle",
  "message",
  "description",
  "emptyText",
])
const OBJECT_LABEL_PROPS = new Set([
  "label",
  "title",
  "subtitle",
  "placeholder",
  "description",
  "message",
])
const LETTER = /\p{L}/u

// ---------------------------------------------------------------------------
// Files

function toPosix(filePath) {
  return filePath.split(path.sep).join("/")
}

function isTestFile(filePath) {
  return /\.test\.[jt]sx?$/.test(filePath)
}

function isSourceFile(filePath) {
  return (
    SOURCE_EXTENSIONS.includes(path.extname(filePath)) &&
    !filePath.endsWith(".d.ts") &&
    !isTestFile(filePath)
  )
}

function walk(directory, out) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(fullPath, out)
    } else if (entry.isFile() && isSourceFile(fullPath)) {
      out.push(fullPath)
    }
  }
}

// Resolves files and directories (relative to baseDir) into a sorted list of
// absolute .ts/.tsx source paths, skipping node_modules, __mocks__, tests and .d.ts.
function collectFiles(paths, baseDir = MOBILE_ROOT) {
  const out = []
  for (const input of paths) {
    const resolved = path.resolve(baseDir, input)
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) walk(resolved, out)
    else if (isSourceFile(resolved)) out.push(resolved)
  }
  return [...new Set(out)].sort()
}

const sourceCache = new Map()

function parse(filePath) {
  const text = fs.readFileSync(filePath, "utf8")
  const cached = sourceCache.get(filePath)
  if (cached && cached.text === text) return cached.sourceFile
  const kind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind)
  sourceCache.set(filePath, { text, sourceFile })
  return sourceFile
}

function visit(node, callback) {
  const descend = callback(node)
  if (descend === false) return
  ts.forEachChild(node, (child) => visit(child, callback))
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function propertyNameText(name) {
  if (!name) return undefined
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return undefined
}

function calleeName(callee) {
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  return undefined
}

// ---------------------------------------------------------------------------
// Unused StyleSheet keys (D-04)

function isStyleSheetCreate(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "StyleSheet" &&
    node.expression.name.text === "create" &&
    node.arguments.length > 0 &&
    ts.isObjectLiteralExpression(node.arguments[0])
  )
}

function resolveImport(fromFile, specifier, knownFiles) {
  if (!specifier.startsWith(".")) return undefined
  const base = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => base + ext)]
  candidates.push(...SOURCE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)))
  return candidates.find((candidate) => knownFiles.has(candidate))
}

// A key is used when the defining file, or a file importing the styles object,
// reads <binding>.<key> or <binding>["key"]. Indexing with a non-literal
// (styles[tone]) or letting the binding escape (passing the whole object on)
// marks every key of that object as used.
function findUnusedStyleKeys(files) {
  const absoluteFiles = files.map((file) => path.resolve(file))
  const knownFiles = new Set(absoluteFiles)
  const definitions = new Map() // `${file}#${binding}` -> { file, binding, keys, used, all }

  for (const file of absoluteFiles) {
    const sourceFile = parse(file)
    visit(sourceFile, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        isStyleSheetCreate(node.initializer)
      ) {
        const keys = []
        for (const property of node.initializer.arguments[0].properties) {
          const name = propertyNameText(property.name)
          if (name !== undefined) keys.push(name)
        }
        definitions.set(`${file}#${node.name.text}`, {
          file,
          binding: node.name.text,
          keys,
          used: new Set(),
          all: false,
        })
      }
    })
  }

  for (const file of absoluteFiles) {
    const sourceFile = parse(file)
    const aliases = new Map() // local name -> definition
    for (const definition of definitions.values()) {
      if (definition.file === file) aliases.set(definition.binding, definition)
    }
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue
      }
      const target = resolveImport(file, statement.moduleSpecifier.text, knownFiles)
      const bindings = statement.importClause && statement.importClause.namedBindings
      if (!target || !bindings || !ts.isNamedImports(bindings)) continue
      for (const element of bindings.elements) {
        const importedName = (element.propertyName || element.name).text
        const definition = definitions.get(`${target}#${importedName}`)
        if (definition) aliases.set(element.name.text, definition)
      }
    }
    if (aliases.size === 0) continue

    visit(sourceFile, (node) => {
      if (!ts.isIdentifier(node) || !aliases.has(node.text)) return
      const definition = aliases.get(node.text)
      const parent = node.parent
      if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
        definition.used.add(parent.name.text)
        return
      }
      if (ts.isElementAccessExpression(parent) && parent.expression === node) {
        const argument = parent.argumentExpression
        if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
          definition.used.add(argument.text)
        } else {
          definition.all = true
        }
        return
      }
      const isDeclarationOrImport =
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        ts.isImportSpecifier(parent) ||
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        ts.isExportSpecifier(parent)
      if (!isDeclarationOrImport) definition.all = true
    })
  }

  const unused = []
  for (const definition of definitions.values()) {
    if (definition.all) continue
    for (const key of definition.keys) {
      if (!definition.used.has(key)) unused.push({ file: definition.file, key })
    }
  }
  return unused
}

// ---------------------------------------------------------------------------
// Long files (D-04)

function isLineLimited(filePath) {
  const posix = `/${toPosix(path.resolve(filePath))}`
  return posix.includes("/src/screens/") || posix.includes("/src/navigation/")
}

function countLines(text) {
  if (text.length === 0) return 0
  const parts = text.split("\n")
  return text.endsWith("\n") ? parts.length - 1 : parts.length
}

function findLongFiles(files, maxLines = 400) {
  const long = []
  for (const file of files) {
    if (isTestFile(file) || !isLineLimited(file)) continue
    const lines = countLines(fs.readFileSync(file, "utf8"))
    if (lines > maxLines) long.push({ file, lines })
  }
  return long
}

// ---------------------------------------------------------------------------
// User-facing literals and status leaks (D-06)

function isI18nFile(filePath) {
  return `/${toPosix(path.resolve(filePath))}`.includes("/src/i18n/")
}

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    const raw = node.getText()
    return raw.slice(1, -1)
  }
  return undefined
}

// Returns the string/template literals an expression can evaluate to, looking
// through parentheses, conditionals, logical fallbacks and concatenation.
function collectLiterals(expression) {
  if (!expression) return []
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
    return collectLiterals(expression.expression)
  }
  if (ts.isConditionalExpression(expression)) {
    return [...collectLiterals(expression.whenTrue), ...collectLiterals(expression.whenFalse)]
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind
    if (operator === ts.SyntaxKind.PlusToken) {
      return [...collectLiterals(expression.left), ...collectLiterals(expression.right)]
    }
    if (
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return [...collectLiterals(expression.left), ...collectLiterals(expression.right)]
    }
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
      return collectLiterals(expression.right)
    }
    return []
  }
  const text = literalText(expression)
  return text !== undefined && LETTER.test(text) ? [{ node: expression, text }] : []
}

function isIgnoredSubtree(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "console"
  ) {
    return true
  }
  return (
    ts.isNewExpression(node) &&
    ts.isIdentifier(node.expression) &&
    /Error$/.test(node.expression.text)
  )
}

function isAlertCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "Alert" &&
    node.expression.name.text === "alert"
  )
}

function statusMessageArgument(node) {
  if (!ts.isCallExpression(node)) return undefined
  const name = calleeName(node.expression)
  if (!name || !STATUS_FUNCTIONS.has(name)) return undefined
  const index = node.arguments.length >= 3 ? 2 : 0
  return node.arguments[index]
}

function oneLine(text) {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > 100 ? `${flat.slice(0, 97)}...` : flat
}

function findUserFacingLiterals(files) {
  const found = []
  for (const file of files) {
    if (isTestFile(file) || isI18nFile(file)) continue
    const sourceFile = parse(file)
    const push = (kind, node, text) =>
      found.push({ file, line: lineOf(sourceFile, node), kind, text: oneLine(text) })
    const pushAll = (kind, expression) => {
      for (const literal of collectLiterals(expression)) push(kind, literal.node, literal.text)
    }

    visit(sourceFile, (node) => {
      if (isIgnoredSubtree(node)) return false

      if (ts.isJsxText(node)) {
        if (LETTER.test(node.text)) push("jsx-text", node, node.text)
        return
      }
      if (
        ts.isJsxExpression(node) &&
        node.expression &&
        (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
      ) {
        pushAll("jsx-text", node.expression)
        return
      }
      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(sourceFile)
        if (TEXT_PROPS.has(name) && node.initializer) {
          if (ts.isStringLiteral(node.initializer)) {
            pushAll("jsx-prop", node.initializer)
          } else if (ts.isJsxExpression(node.initializer)) {
            pushAll("jsx-prop", node.initializer.expression)
          }
        }
        return
      }
      if (isAlertCall(node)) {
        const [title, message, buttons] = node.arguments
        pushAll("alert", title)
        pushAll("alert", message)
        if (buttons && ts.isArrayLiteralExpression(buttons)) {
          for (const button of buttons.elements) {
            if (!ts.isObjectLiteralExpression(button)) continue
            for (const property of button.properties) {
              if (ts.isPropertyAssignment(property) && propertyNameText(property.name) === "text") {
                pushAll("alert-button", property.initializer)
              }
            }
          }
        }
        return
      }
      const statusArgument = statusMessageArgument(node)
      if (statusArgument) pushAll("status", statusArgument)
      if (ts.isPropertyAssignment(node) && OBJECT_LABEL_PROPS.has(propertyNameText(node.name))) {
        pushAll("object-label", node.initializer)
      }
      return undefined
    })
  }
  return found
}

function isLeakyName(name) {
  return name === "id" || /Id$/.test(name) || /_id$/.test(name)
}

function findStatusIdLeaks(files) {
  const leaks = []
  for (const file of files) {
    if (isTestFile(file)) continue
    const sourceFile = parse(file)
    visit(sourceFile, (node) => {
      const argument = statusMessageArgument(node)
      if (!argument) return
      let leaky = false
      visit(argument, (inner) => {
        if (leaky) return false
        if (ts.isIdentifier(inner) && isLeakyName(inner.text)) leaky = true
        if (ts.isPropertyAccessExpression(inner) && inner.name.text === "message") leaky = true
        return undefined
      })
      if (leaky) {
        leaks.push({
          file,
          line: lineOf(sourceFile, argument),
          text: oneLine(argument.getText(sourceFile)),
        })
      }
    })
  }
  return leaks
}

// ---------------------------------------------------------------------------
// CLI

const CHECKS = {
  "unused-styles": (files, all) => {
    // Usage is resolved over the whole tree so importers outside the requested
    // paths still count; only keys defined in the requested files are reported.
    const requested = new Set(files)
    return findUnusedStyleKeys([...new Set([...all, ...files])]).filter((item) =>
      requested.has(item.file),
    )
  },
  "long-files": (files) => findLongFiles(files),
  literals: (files) => findUserFacingLiterals(files),
  "status-ids": (files) => findStatusIdLeaks(files),
}

function formatItem(item) {
  const file = toPosix(path.relative(MOBILE_ROOT, item.file))
  if (item.key !== undefined) return `${file} ${item.key}`
  if (item.lines !== undefined) return `${file} ${item.lines}`
  if (item.kind !== undefined) return `${file}:${item.line} ${item.kind} ${item.text}`
  return `${file}:${item.line} ${item.text}`
}

function main(argv) {
  const [check, ...rest] = argv
  const usage =
    "Usage: structure-report.js <unused-styles|long-files|literals|status-ids> [paths...] [--max N] [--json]"
  if (!check || !CHECKS[check]) {
    console.error(usage)
    return 2
  }

  const paths = []
  let max
  let json = false
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === "--json") json = true
    else if (arg === "--max") {
      max = Number(rest[index + 1])
      index += 1
      if (!Number.isInteger(max) || max < 0) {
        console.error("--max expects a non-negative integer")
        return 2
      }
    } else paths.push(arg)
  }

  const files = collectFiles(paths.length > 0 ? paths : DEFAULT_PATHS, MOBILE_ROOT)
  const all = collectFiles(DEFAULT_PATHS, MOBILE_ROOT)
  const items = CHECKS[check](files, all)

  if (json) {
    const relativeItems = items.map((item) => ({
      ...item,
      file: toPosix(path.relative(MOBILE_ROOT, item.file)),
    }))
    console.log(JSON.stringify({ check, count: items.length, items: relativeItems }, null, 2))
  } else {
    console.log(`${check}: ${items.length}`)
    for (const item of items) console.log(formatItem(item))
  }

  return max !== undefined && items.length > max ? 1 : 0
}

module.exports = {
  DEFAULT_PATHS,
  collectFiles,
  findUnusedStyleKeys,
  findLongFiles,
  findUserFacingLiterals,
  findStatusIdLeaks,
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2))
}
