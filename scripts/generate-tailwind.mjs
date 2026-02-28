import { compile } from 'tailwindcss'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const srcDir = path.join(projectRoot, 'src')
const outputFile = path.join(srcDir, 'tailwind.generated.css')

const TEXT_FILE_EXTENSIONS = new Set(['.html', '.ts', '.tsx', '.js', '.jsx'])
const CLASS_PATTERNS = [
  /className\s*=\s*"([^"]+)"/g,
  /className\s*=\s*'([^']+)'/g,
  /className\s*=\s*`([^`]+)`/g,
  /class\s*=\s*"([^"]+)"/g,
  /class\s*=\s*'([^']+)'/g,
]

const STRING_LITERAL_PATTERNS = [
  /"([^"\n]+)"/g,
  /'([^'\n]+)'/g,
  /`([^`\n]+)`/g,
]

const CLASS_TOKEN_REGEX = /^[!a-z0-9_:/.[\]()%#,-]+$/

const EXTRA_CANDIDATES = [
  'hidden',
  'block',
  'pointer-events-none',
]

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
      continue
    }

    const extension = path.extname(entry.name)
    if (TEXT_FILE_EXTENSIONS.has(extension)) {
      files.push(fullPath)
    }
  }

  return files
}

function extractCandidates(content) {
  const candidates = new Set()
  const addTokens = (value) => {
    value
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        if (item.includes('${') || item.includes('{') || item.includes('}')) {
          return
        }

        if (CLASS_TOKEN_REGEX.test(item)) {
          candidates.add(item)
        }
      })
  }

  for (const pattern of CLASS_PATTERNS) {
    pattern.lastIndex = 0
    let match = pattern.exec(content)

    while (match) {
      addTokens(match[1])
      match = pattern.exec(content)
    }
  }

  for (const pattern of STRING_LITERAL_PATTERNS) {
    pattern.lastIndex = 0
    let match = pattern.exec(content)

    while (match) {
      addTokens(match[1])
      match = pattern.exec(content)
    }
  }

  return candidates
}

async function loadStylesheet(id, base) {
  const resolvedBase = base || projectRoot

  if (id === 'tailwindcss') {
    const filePath = path.join(projectRoot, 'node_modules', 'tailwindcss', 'index.css')
    return {
      path: filePath,
      base: path.dirname(filePath),
      content: await fs.readFile(filePath, 'utf8'),
    }
  }

  if (id.startsWith('tailwindcss/')) {
    const filePath = path.join(projectRoot, 'node_modules', id)
    return {
      path: filePath,
      base: path.dirname(filePath),
      content: await fs.readFile(filePath, 'utf8'),
    }
  }

  const filePath = path.resolve(resolvedBase, id)

  return {
    path: filePath,
    base: path.dirname(filePath),
    content: await fs.readFile(filePath, 'utf8'),
  }
}

async function buildTailwindCss() {
  const allFiles = [path.join(projectRoot, 'index.html'), ...(await walk(srcDir))]
  const candidateSet = new Set(EXTRA_CANDIDATES)

  for (const filePath of allFiles) {
    const content = await fs.readFile(filePath, 'utf8')
    extractCandidates(content).forEach((item) => candidateSet.add(item))
  }

  const compiler = await compile('@import "tailwindcss";', {
    base: projectRoot,
    from: path.join(srcDir, 'tailwind.input.css'),
    loadStylesheet,
  })

  const css = compiler.build([...candidateSet])

  await fs.writeFile(outputFile, css, 'utf8')

  console.log(`Tailwind generated: ${path.relative(projectRoot, outputFile)} (${candidateSet.size} classes)`)
}

buildTailwindCss().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
