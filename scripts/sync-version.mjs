import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const packageJsonPath = resolve(root, 'package.json');
const readmePath = resolve(root, 'README.md');
const changelogPath = resolve(root, 'CHANGELOG.md');

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = `v${pkg.version}`;
const today = new Date().toISOString().slice(0, 10);

const syncReadme = () => {
  let readme = readFileSync(readmePath, 'utf8');

  const versionLine = `> Current Version: ${version}`;
  if (/^> Current Version: .*$/m.test(readme)) {
    readme = readme.replace(/^> Current Version: .*$/m, versionLine);
  } else {
    readme = readme.replace(
      'พัฒนาด้วย Next.js (App Router) + TypeScript + Tailwind CSS + ชุดคอมโพเนนต์แนว shadcn/ui\n',
      `พัฒนาด้วย Next.js (App Router) + TypeScript + Tailwind CSS + ชุดคอมโพเนนต์แนว shadcn/ui\n\n${versionLine}\n\nดูรายละเอียดการเปลี่ยนแปลงทั้งหมดที่ CHANGELOG.md\n`,
    );
  }

  readme = readme.replace(
    /^### v\d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)$/m,
    `### ${version} (${today})`,
  );

  writeFileSync(readmePath, readme, 'utf8');
};

const syncChangelog = () => {
  let changelog = readFileSync(changelogPath, 'utf8');

  if (/^## v\d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)$/m.test(changelog)) {
    changelog = changelog.replace(
      /^## v\d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)$/m,
      `## ${version} (${today})`,
    );
  }

  writeFileSync(changelogPath, changelog, 'utf8');
};

syncReadme();
syncChangelog();

console.log(`Synced version ${version} to README.md and CHANGELOG.md`);
