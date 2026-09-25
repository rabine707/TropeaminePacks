import fs from 'node:fs'

const path = 'components/collection-app.tsx'
let source = fs.readFileSync(path, 'utf8')
const needle = '<button className="avatar small" onClick={()=>setSettings(true)} aria-label="Collection settings">R</button>'

if (!source.includes(needle)) {
  throw new Error('Could not find the collection settings avatar button')
}

source = source.replace(
  needle,
  '<Link className="text-link" href="/login">Sign in</Link>' + needle
)

fs.writeFileSync(path, source)
