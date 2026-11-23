import { stripTypeScriptTypes } from 'node:module';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
for (const dir of ['dist', 'web/lib', 'extension/lib']) await mkdir(dir, {recursive:true});
for (const name of ['compiler', 'interpreter', 'runtime']) {
  const source = await readFile(`src/${name}.ts`, 'utf8');
  const js = stripTypeScriptTypes(source, {mode:'strip'}).replaceAll(".ts'", ".js'");
  await writeFile(`dist/${name}.js`, js);
  {
    await writeFile(`web/lib/${name}.js`, js);
    await writeFile(`extension/lib/${name}.js`, js);
  }
}
for (const file of ['index.html','app.js','style.css','worker.js']) await cp(`web/${file}`, `extension/${file}`);
console.log('Built compiler, runtime, browser editor and extension.');
