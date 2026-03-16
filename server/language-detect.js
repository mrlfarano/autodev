// server/language-detect.js — detect language/framework of a repository

import fs from 'node:fs';
import path from 'node:path';

const DETECTION_RULES = [
  // Next.js (check before generic JS/TS)
  {
    files: ['next.config.ts', 'next.config.js', 'next.config.mjs'],
    language: 'nextjs',
    framework: 'Next.js',
    template: 'nextjs',
  },

  // Python — Django (check before generic Python)
  {
    files: ['manage.py'],
    language: 'python',
    framework: 'Django',
    template: 'python',
  },

  // Python — generic
  {
    files: ['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile'],
    language: 'python',
    framework: 'Python',
    template: 'python',
  },

  // Rust
  {
    files: ['Cargo.toml'],
    language: 'rust',
    framework: 'Rust',
    template: 'rust',
  },

  // Go
  {
    files: ['go.mod'],
    language: 'go',
    framework: 'Go',
    template: 'go',
  },

  // Java — Maven
  {
    files: ['pom.xml'],
    language: 'java',
    framework: 'Maven',
    template: 'java-maven',
  },

  // Java — Gradle
  {
    files: ['build.gradle', 'build.gradle.kts'],
    language: 'java',
    framework: 'Gradle',
    template: 'java-gradle',
  },

  // C#
  {
    files: ['*.csproj', '*.sln'],
    language: 'csharp',
    framework: '.NET',
    template: 'csharp',
  },

  // Ruby — Rails (check before generic Ruby)
  {
    files: ['Gemfile', 'config/routes.rb'],
    language: 'ruby',
    framework: 'Rails',
    template: 'ruby',
    requireAll: true,
  },

  // Ruby — generic
  {
    files: ['Gemfile'],
    language: 'ruby',
    framework: 'Ruby',
    template: 'ruby',
  },

  // TypeScript (check after Next.js)
  {
    files: ['tsconfig.json'],
    language: 'typescript',
    framework: 'TypeScript',
    template: 'typescript',
  },

  // JavaScript / Node.js
  {
    files: ['package.json'],
    language: 'javascript',
    framework: 'Node.js',
    template: 'typescript',
  },
];

/**
 * Check whether a file pattern matches something in the directory.
 * Supports literal filenames, paths with slashes, and simple glob like *.ext.
 */
function fileExists(repoPath, pattern) {
  // Pattern with a subdirectory path (e.g. "config/routes.rb")
  if (pattern.includes('/')) {
    return fs.existsSync(path.join(repoPath, pattern));
  }

  // Glob pattern like "*.csproj"
  if (pattern.startsWith('*')) {
    const ext = pattern.slice(1); // e.g. ".csproj"
    try {
      const entries = fs.readdirSync(repoPath);
      return entries.some((e) => e.endsWith(ext));
    } catch {
      return false;
    }
  }

  // Literal filename
  return fs.existsSync(path.join(repoPath, pattern));
}

/**
 * Detect the primary language and framework of a repository.
 *
 * @param {string} repoPath  Absolute path to the repo root
 * @returns {{ language: string, framework: string, template: string, confidence: number, detectedBy: string[] }}
 */
export function detectLanguage(repoPath) {
  for (const rule of DETECTION_RULES) {
    const matched = [];

    for (const file of rule.files) {
      if (fileExists(repoPath, file)) {
        matched.push(file);
      }
    }

    // If requireAll is set, all files must be present
    if (rule.requireAll) {
      if (matched.length === rule.files.length) {
        return {
          language: rule.language,
          framework: rule.framework,
          template: rule.template,
          confidence: 0.95,
          detectedBy: matched,
        };
      }
      continue;
    }

    // Otherwise, any one match is enough
    if (matched.length > 0) {
      // Confidence is higher when more indicator files are found
      const confidence = Math.min(0.95, 0.7 + matched.length * 0.1);
      return {
        language: rule.language,
        framework: rule.framework,
        template: rule.template,
        confidence,
        detectedBy: matched,
      };
    }
  }

  return {
    language: 'unknown',
    framework: 'Unknown',
    template: 'generic',
    confidence: 0,
    detectedBy: [],
  };
}
