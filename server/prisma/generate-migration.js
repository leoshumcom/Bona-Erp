/**
 * 生成D1迁移SQL
 * 绕过PowerShell新行折叠问题
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // 直接执行prisma migrate diff，使用stdio pipe获取原始输出
  const result = execSync(
    'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024, // 1MB
      windowsHide: true,
    }
  );

  if (!result || result.length < 100) {
    console.error('Migration SQL output too short:', result?.length || 0, 'bytes');
    process.exit(1);
  }

  // 按语句拆分：每个 CREATE TABLE/CREATE INDEX 单独一行
  const lines = result
    .replace(/;\s*--\s*Create/g, ';\n\n-- Create')
    .split('\n');

  fs.writeFileSync(
    path.join(__dirname, 'd1-migration.sql'),
    lines.join('\n'),
    'utf-8'
  );

  console.log(`Generated ${lines.length} lines (${result.length} bytes)`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
