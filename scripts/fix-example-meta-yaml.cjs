const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// .dialogoi-meta.yamlファイルを再帰的に検索
function findMetaYamlFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...findMetaYamlFiles(path.join(dir, entry.name)));
    } else if (entry.name === '.dialogoi-meta.yaml') {
      files.push(path.join(dir, entry.name));
    }
  }
  
  return files;
}

// ファイルアイテムを修正
function fixFileItem(item) {
  if (item.type === 'content') {
    // 必須フィールドを追加
    if (!item.hash) item.hash = '';
    if (!item.tags) item.tags = [];
    if (!Array.isArray(item.tags)) item.tags = [item.tags];
    if (!item.references) item.references = [];
    if (!Array.isArray(item.references)) item.references = [item.references];
    if (!item.comments) item.comments = '';
    if (item.isUntracked === undefined) item.isUntracked = false;
    if (item.isMissing === undefined) item.isMissing = false;
  } else if (item.type === 'setting') {
    // 必須フィールドを追加
    if (!item.hash) item.hash = '';
    if (!item.tags) item.tags = [];
    if (!Array.isArray(item.tags)) item.tags = [item.tags];
    if (!item.comments) item.comments = '';
    if (item.isUntracked === undefined) item.isUntracked = false;
    if (item.isMissing === undefined) item.isMissing = false;
  } else if (item.type === 'subdirectory') {
    // 必須フィールドを追加
    if (item.isUntracked === undefined) item.isUntracked = false;
    if (item.isMissing === undefined) item.isMissing = false;
  }
  
  return item;
}

// メインの処理
const examplesDir = path.join(__dirname, '..', 'examples');
const files = findMetaYamlFiles(examplesDir);

console.log(`Found ${files.length} .dialogoi-meta.yaml files`);

for (const file of files) {
  console.log(`Processing: ${file}`);
  
  try {
    const content = fs.readFileSync(file, 'utf8');
    const data = yaml.load(content);
    
    // readmeフィールドがなければ追加
    if (!data.readme) {
      data.readme = 'README.md';
    }
    
    // 各ファイルアイテムを修正
    if (data.files && Array.isArray(data.files)) {
      data.files = data.files.map(fixFileItem);
    }
    
    // YAMLとして保存
    const updatedContent = yaml.dump(data, {
      lineWidth: -1,
      noRefs: true,
    });
    
    fs.writeFileSync(file, updatedContent);
    console.log(`✓ Fixed: ${file}`);
  } catch (error) {
    console.error(`✗ Error processing ${file}:`, error.message);
  }
}

console.log('Done!');