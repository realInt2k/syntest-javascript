import fg from 'fast-glob';
import path from 'path';
import fs from "fs";

const ENTRY_DIR = path.resolve('./'); 
const EXTENSIONS = ['.js', '.ts'];  

export async function collectFiles(entryDir = ENTRY_DIR) {
  const patterns = EXTENSIONS.map(ext => `${entryDir.replace(/\\/g, '/')}/**/*${ext}`);
  const files = await fg(patterns, { dot: true, onlyFiles: true });
  const relativeFiles = files.map(f => path.relative(entryDir, f));
  return relativeFiles;
}

export async function collectFileSources(entryDir = ENTRY_DIR) {
  const patterns = EXTENSIONS.map(ext => `${entryDir.replace(/\\/g, '/')}/**/*${ext}`);
  const files = await fg(patterns, { dot: true, onlyFiles: true });
  const relativeFiles = files.map(f => path.relative(entryDir, f));
  const sources = relativeFiles.map(f => {
    return {
        "name": f,
        "code": fs.readFileSync(f, "utf8")
    }
  })
  return sources;
}

