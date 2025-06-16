#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Generate NOTICES file for Crystal application
 * This script collects all third-party licenses and creates a NOTICES file
 */

const NOTICES_HEADER = `THIRD-PARTY SOFTWARE NOTICES AND INFORMATION
============================================

Crystal includes third-party software components. The following notices and license terms apply to various components distributed with Crystal.

================================================================================

`;

// Dev-only packages that aren't distributed with the built app
const DEV_ONLY_PACKAGES = [
  '@eslint/',
  '@playwright/',
  '@types/',
  '@typescript-eslint/',
  '@vitejs/',
  'autoprefixer',
  'concurrently',
  'electron-builder',
  'electron-rebuild',
  'eslint',
  'globals',
  'mkdirp',
  'playwright',
  'postcss',
  'rimraf',
  'tailwindcss',
  'typescript',
  'typescript-eslint',
  'vite',
  'wait-on'
];

function isDevOnlyPackage(packageName) {
  return DEV_ONLY_PACKAGES.some(devPkg => 
    packageName === devPkg || packageName.startsWith(devPkg)
  );
}

function getLicenseText(packagePath) {
  const licenseFiles = [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'license',
    'license.md',
    'license.txt',
    'LICENCE',
    'LICENCE.md',
    'LICENCE.txt',
    'LICENSE-MIT',
    'LICENSE.MIT',
    'COPYING',
    'COPYING.txt'
  ];

  // Try to find a license file
  for (const file of licenseFiles) {
    const licensePath = path.join(packagePath, file);
    if (fs.existsSync(licensePath)) {
      return fs.readFileSync(licensePath, 'utf8').trim();
    }
  }

  // Check in package.json for license field
  const packageJsonPath = path.join(packagePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Sometimes license text is embedded in package.json
      if (packageJson.licenseText) {
        return packageJson.licenseText;
      }
      
      // Return standard license name if available
      if (packageJson.license) {
        return `License: ${packageJson.license}`;
      }
    } catch (e) {
      console.warn(`Error reading package.json for ${packagePath}: ${e.message}`);
    }
  }

  return null;
}

function getPackageInfo(packagePath) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return {
        name: packageJson.name,
        version: packageJson.version,
        author: packageJson.author,
        homepage: packageJson.homepage,
        repository: packageJson.repository
      };
    } catch (e) {
      return null;
    }
  }
  return null;
}

function collectPackagesFromNodeModules(nodeModulesPath, licenses, processedPaths) {
  if (!fs.existsSync(nodeModulesPath)) return;

  const entries = fs.readdirSync(nodeModulesPath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const fullPath = path.join(nodeModulesPath, entry.name);
    
    // Handle scoped packages
    if (entry.name.startsWith('@')) {
      const scopedEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (scopedEntry.isDirectory()) {
          const scopedPackagePath = path.join(fullPath, scopedEntry.name);
          processPackage(scopedPackagePath, `${entry.name}/${scopedEntry.name}`, licenses, processedPaths);
        }
      }
    } else {
      processPackage(fullPath, entry.name, licenses, processedPaths);
    }
  }
}

function processPackage(packagePath, packageName, licenses, processedPaths) {
  // Skip if already processed
  if (processedPaths.has(packagePath)) return;
  processedPaths.add(packagePath);
  
  // Skip dev-only packages
  if (isDevOnlyPackage(packageName)) return;
  
  const packageInfo = getPackageInfo(packagePath);
  if (!packageInfo) return;
  
  const key = `${packageInfo.name}@${packageInfo.version}`;
  
  // Skip if we already have this exact version
  if (licenses.has(key)) return;
  
  console.log(`Processing ${key}`);
  
  const licenseText = getLicenseText(packagePath);
  if (licenseText) {
    licenses.set(key, {
      name: packageInfo.name,
      version: packageInfo.version,
      author: packageInfo.author,
      homepage: packageInfo.homepage,
      repository: packageInfo.repository,
      license: licenseText
    });
  } else {
    console.warn(`No license found for: ${key}`);
  }
}

function collectAllLicenses() {
  console.log('Collecting third-party licenses...');
  
  const licenses = new Map();
  const processedPaths = new Set();
  const rootDir = path.join(__dirname, '..');
  
  // Collect from all possible node_modules locations
  const nodeModulesPaths = [
    path.join(rootDir, 'node_modules'),
    path.join(rootDir, 'frontend', 'node_modules'),
    path.join(rootDir, 'main', 'node_modules')
  ];
  
  for (const nodeModulesPath of nodeModulesPaths) {
    collectPackagesFromNodeModules(nodeModulesPath, licenses, processedPaths);
  }
  
  return licenses;
}

function formatLicenseEntry(info) {
  let entry = `Package: ${info.name}\n`;
  entry += `Version: ${info.version}\n`;
  
  if (info.author) {
    const author = typeof info.author === 'object' ? info.author.name : info.author;
    if (author) entry += `Author: ${author}\n`;
  }
  
  if (info.homepage) {
    entry += `Homepage: ${info.homepage}\n`;
  } else if (info.repository) {
    const repo = typeof info.repository === 'object' ? info.repository.url : info.repository;
    if (repo) entry += `Repository: ${repo}\n`;
  }
  
  entry += `\n${info.license}\n`;
  
  return entry;
}

function generateNotices() {
  const licenses = collectAllLicenses();
  
  let notices = NOTICES_HEADER;
  
  // Sort packages alphabetically
  const sortedLicenses = Array.from(licenses.entries())
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
  
  for (const [key, info] of sortedLicenses) {
    notices += formatLicenseEntry(info);
    notices += '\n================================================================================\n\n';
  }
  
  // Add Crystal's own license
  const crystalPackageJson = require('../package.json');
  notices += `Package: Crystal\n`;
  notices += `Version: ${crystalPackageJson.version}\n`;
  notices += `Author: ${crystalPackageJson.author}\n`;
  notices += `License: ${crystalPackageJson.license}\n`;
  notices += `\n${fs.readFileSync(path.join(__dirname, '..', 'LICENSE'), 'utf8')}\n`;
  
  return notices;
}

function main() {
  try {
    const notices = generateNotices();
    const outputPath = path.join(__dirname, '..', 'NOTICES');
    
    fs.writeFileSync(outputPath, notices);
    console.log(`\nNOTICES file generated successfully at: ${outputPath}`);
    
    // Count licenses
    const count = (notices.match(/Package:/g) || []).length;
    console.log(`Total packages included: ${count}`);
    
    // Verify file was created
    const stats = fs.statSync(outputPath);
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('Error generating NOTICES file:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateNotices };