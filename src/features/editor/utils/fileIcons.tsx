import type { Icon } from "@/components/icons"
import {
  File,
  FileTs,
  FileJs,
  FileJsx,
  FileTsx,
  FileHtml,
  FileCss,
  BracketsCurly,
  FileMd,
  FileSql,
  FilePy,
  FileRs,
  FileCode,
  FileText,
  FileSvg,
  FilePng,
  FileJpg,
  FileZip,
  FilePdf,
  FileDoc,
  FileXls,
  FilePpt,
  FileVideo,
  FileAudio,
  FileImage,
  FileLock,
  FileCpp,
  FileCSharp,
  FileC,
  FileVue,
  FileCsv,
  GearSix,
  GitBranch,
} from "@/components/icons"

type FileIconMap = Record<string, Icon>

// Map file extensions to Phosphor icons
const extensionIconMap: FileIconMap = {
  // TypeScript/JavaScript
  ts: FileTs,
  tsx: FileTsx,
  js: FileJs,
  jsx: FileJsx,
  mjs: FileJs,
  cjs: FileJs,
  vue: FileVue,

  // Web
  html: FileHtml,
  htm: FileHtml,
  css: FileCss,
  scss: FileCss,
  sass: FileCss,
  less: FileCss,
  svg: FileSvg,

  // Data/Config
  json: BracketsCurly,
  yaml: FileCode,
  yml: FileCode,
  toml: FileCode,
  xml: FileCode,
  env: GearSix,
  csv: FileCsv,

  // Documentation
  md: FileMd,
  mdx: FileMd,
  txt: FileText,
  pdf: FilePdf,
  doc: FileDoc,
  docx: FileDoc,

  // Programming Languages
  py: FilePy,
  rs: FileRs,
  go: FileCode,
  java: FileCode,
  kt: FileCode,
  swift: FileCode,
  c: FileC,
  cpp: FileCpp,
  h: FileC,
  hpp: FileCpp,
  cs: FileCSharp,
  rb: FileCode,
  php: FileCode,
  lua: FileCode,
  sh: FileCode,
  bash: FileCode,
  zsh: FileCode,
  fish: FileCode,
  ps1: FileCode,
  sql: FileSql,

  // Images
  png: FilePng,
  jpg: FileJpg,
  jpeg: FileJpg,
  gif: FileImage,
  webp: FileImage,
  ico: FileImage,
  bmp: FileImage,

  // Archives
  zip: FileZip,
  tar: FileZip,
  gz: FileZip,
  rar: FileZip,
  "7z": FileZip,

  // Spreadsheets/Presentations
  xls: FileXls,
  xlsx: FileXls,
  ppt: FilePpt,
  pptx: FilePpt,

  // Media
  mp4: FileVideo,
  mov: FileVideo,
  avi: FileVideo,
  mkv: FileVideo,
  webm: FileVideo,
  mp3: FileAudio,
  wav: FileAudio,
  ogg: FileAudio,
  flac: FileAudio,

  // Lock files
  lock: FileLock,
}

// Map specific filenames to icons
const filenameIconMap: FileIconMap = {
  ".gitignore": GitBranch,
  ".gitattributes": GitBranch,
  ".gitmodules": GitBranch,
  ".env": GearSix,
  ".env.local": GearSix,
  ".env.development": GearSix,
  ".env.production": GearSix,
  ".eslintrc": GearSix,
  ".eslintrc.js": GearSix,
  ".eslintrc.json": GearSix,
  ".prettierrc": GearSix,
  ".prettierrc.js": GearSix,
  ".prettierrc.json": GearSix,
  "tsconfig.json": FileTs,
  "jsconfig.json": FileJs,
  "package.json": BracketsCurly,
  "package-lock.json": FileLock,
  "bun.lockb": FileLock,
  "yarn.lock": FileLock,
  "pnpm-lock.yaml": FileLock,
  "Cargo.lock": FileLock,
  "Cargo.toml": FileRs,
  Dockerfile: FileCode,
  "docker-compose.yml": FileCode,
  "docker-compose.yaml": FileCode,
  Makefile: FileCode,
  LICENSE: FileText,
  README: FileMd,
  "README.md": FileMd,
}

export function getFileIcon(filename: string): Icon {
  // Check exact filename match first
  if (filenameIconMap[filename]) {
    return filenameIconMap[filename]
  }

  // Get extension
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext && extensionIconMap[ext]) {
    return extensionIconMap[ext]
  }

  // Default to generic file icon
  return File
}
