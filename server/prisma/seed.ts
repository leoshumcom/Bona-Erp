import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始初始化博纳ERP基础数据...\n');

  // 1. 创建公司
  const company = await prisma.company.upsert({
    where: { code: 'BONA' },
    update: {},
    create: {
      code: 'BONA',
      name: '博纳光电科技有限公司',
      address: '广东省深圳市宝安区',
      contactPerson: '张总',
      phone: '13800000000',
      email: 'sales@bona-official.com',
      currency: 'CNY',
    },
  });
  console.log('✅ 公司:', company.name);

  // 2. 创建部门（Department无code字段，用name+companyId查重）
  const deptData = [
    { name: '管理部' },
    { name: '工厂部' },
    { name: '仓储部' },
    { name: '运营部' },
    { name: '售后部' },
  ];

  for (const d of deptData) {
    const existing = await prisma.department.findFirst({
      where: { name: d.name, companyId: company.id },
    });
    if (!existing) {
      await prisma.department.create({
        data: { name: d.name, companyId: company.id },
      });
    }
  }
  console.log('✅ 部门: 5个');

  // 3. 创建管理员账户
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      realName: '系统管理员',
      email: 'admin@bona-official.com',
      role: 'ADMIN',
      companyId: company.id,
      status: 'active',
    },
  });
  console.log('✅ 管理员: admin / admin123 (角色: ADMIN)');

  // 4. 创建各角色测试账户
  const testPassword = await bcrypt.hash('test123', 10);
  const testUsers = [
    { username: 'boss', realName: '老板', email: 'boss@bona-official.com', role: 'BOSS' },
    { username: 'factory', realName: '工厂经理', email: 'factory@bona-official.com', role: 'FACTORY_MANAGER' },
    { username: 'warehouse', realName: '仓库经理', email: 'warehouse@bona-official.com', role: 'WAREHOUSE_MANAGER' },
    { username: 'operator', realName: '运营主管', email: 'operator@bona-official.com', role: 'OPERATOR' },
    { username: 'aftersales', realName: '售后专员', email: 'aftersales@bona-official.com', role: 'AFTERSALES' },
    { username: 'viewer', realName: '查看者', email: 'viewer@bona-official.com', role: 'VIEWER' },
  ];

  for (const u of testUsers) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        ...u,
        passwordHash: testPassword,
        companyId: company.id,
        status: 'active',
      },
    });
  }
  console.log('✅ 测试账户: 6个 (密码统一: test123)');

  // 5. 创建平台
  const platforms = [
    { code: 'AMAZON', name: 'Amazon' },
    { code: 'TIKTOK', name: 'TikTok Shop' },
    { code: 'TEMU', name: 'Temu' },
    { code: 'SHOPEE', name: 'Shopee' },
    { code: 'LAZADA', name: 'Lazada' },
    { code: 'INDEPENDENT', name: '独立站' },
  ];

  const platformRecords: Record<string, string> = {};
  for (const p of platforms) {
    const created = await prisma.platform.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    platformRecords[p.code] = created.id;
  }
  console.log('✅ 平台: 6个');

  // 6. 创建示例店铺（Store没有marketplaceId字段）
  const stores = [
    { platformCode: 'AMAZON', name: '亚马逊美国站', storeId: 'US-001' },
    { platformCode: 'AMAZON', name: '亚马逊欧洲站', storeId: 'EU-001' },
    { platformCode: 'TIKTOK', name: 'TikTok美区店', storeId: 'TT-US-001' },
    { platformCode: 'TEMU', name: 'Temu全球店', storeId: 'TEMU-001' },
    { platformCode: 'SHOPEE', name: 'Shopee东南亚', storeId: 'SP-001' },
  ];

  for (const s of stores) {
    const existing = await prisma.store.findFirst({
      where: { storeId: s.storeId, platformId: platformRecords[s.platformCode] },
    });
    if (!existing) {
      await prisma.store.create({
        data: {
          platformId: platformRecords[s.platformCode],
          name: s.name,
          storeId: s.storeId,
        },
      });
    }
  }
  console.log('✅ 店铺: 5个');

  // 7. 创建计量单位（UnitOfMeasure: code, description, category, isActive）
  const uoms = [
    { code: 'PCS', description: '个', category: 'count' },
    { code: 'SET', description: '套', category: 'count' },
    { code: 'PAIR', description: '对', category: 'count' },
    { code: 'KG', description: '千克', category: 'weight' },
    { code: 'M', description: '米', category: 'length' },
    { code: 'M2', description: '平方米', category: 'length' },
  ];

  const uomRecords: Record<string, string> = {};
  for (const u of uoms) {
    const created = await prisma.unitOfMeasure.upsert({
      where: { code: u.code },
      update: {},
      create: u,
    });
    uomRecords[u.code] = created.id;
  }
  console.log('✅ 计量单位: 6个');

  // 8. 创建仓库（Warehouse: isActive boolean, not status String）
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      code: 'MAIN',
      name: '深圳主仓库',
      address: '深圳市宝安区',
      isActive: true,
    },
  });

  // StorageLocation: @@unique([warehouseId, code]), isActive boolean, description not name
  const locations = ['A-01', 'A-02', 'A-03', 'B-01', 'B-02', 'C-01', 'C-02', 'D-01'];
  for (const loc of locations) {
    const existing = await prisma.storageLocation.findFirst({
      where: { warehouseId: mainWarehouse.id, code: loc },
    });
    if (!existing) {
      await prisma.storageLocation.create({
        data: {
          code: loc,
          description: `库位${loc}`,
          warehouseId: mainWarehouse.id,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ 仓库: 1个 + 库位: 8个');

  // 9. 创建示例产品
  const pcsId = uomRecords['PCS'];
  const sampleProducts = [
    { sku: 'BN-LED-H7-001', name: 'H7 LED大灯 6000K', category: 'LED大灯', materialType: 'FINISHED_GOOD', brand: 'Bona' },
    { sku: 'BN-LED-H4-001', name: 'H4 LED大灯 6500K', category: 'LED大灯', materialType: 'FINISHED_GOOD', brand: 'Bona' },
    { sku: 'BN-LED-9005-01', name: '9005 LED雾灯', category: 'LED雾灯', materialType: 'FINISHED_GOOD', brand: 'Bona' },
    { sku: 'BN-MAT-AL-001', name: '铝合金灯体散热片', category: '散热组件', materialType: 'RAW_MATERIAL', brand: 'Bona' },
    { sku: 'BN-MAT-LENS-01', name: '光学透镜组', category: '光学组件', materialType: 'RAW_MATERIAL', brand: 'Bona' },
    { sku: 'BN-MAT-CHIP-01', name: 'LED芯片 CSP3570', category: '电子元件', materialType: 'RAW_MATERIAL', brand: 'Bona' },
    { sku: 'BN-MAT-PCB-001', name: 'PCB驱动板 12V/24V', category: '电子元件', materialType: 'RAW_MATERIAL', brand: 'Bona' },
    { sku: 'BN-MAT-PKG-01', name: '包装盒套装', category: '包装材料', materialType: 'CONSUMABLE', brand: 'Bona' },
  ];

  for (const p of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...p, unitOfMeasureId: pcsId },
    });
  }
  console.log('✅ 产品: 8个 (3成品 + 4原材料 + 1耗材)');

  // 10. 创建示例供应商（Supplier: supplierNumber not code）
  const suppliers = [
    { supplierNumber: 'SUP-AL', name: '东莞铝合金精密加工', contactPerson: '李工', contactPhone: '13900000001' },
    { supplierNumber: 'SUP-CHIP', name: '深圳LED芯片供应商', contactPerson: '王经理', contactPhone: '13900000002' },
    { supplierNumber: 'SUP-PCB', name: '惠州PCB线路板厂', contactPerson: '赵总', contactPhone: '13900000003' },
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { supplierNumber: s.supplierNumber },
      update: {},
      create: s,
    });
  }
  console.log('✅ 供应商: 3个');

  // 11. 创建工作中心（WorkCenter: type required, costPerHour, capacityPerDay, isActive）
  const workCenters = [
    { code: 'WC-ASM', name: '装配车间', type: 'ASSEMBLY' as const, costPerHour: 45, capacityPerDay: 500 },
    { code: 'WC-TEST', name: '测试车间', type: 'INSPECTION' as const, costPerHour: 35, capacityPerDay: 300 },
    { code: 'WC-PKG', name: '包装车间', type: 'PACKAGING' as const, costPerHour: 25, capacityPerDay: 800 },
  ];

  for (const wc of workCenters) {
    await prisma.workCenter.upsert({
      where: { code: wc.code },
      update: {},
      create: wc,
    });
  }
  console.log('✅ 工作中心: 3个');

  console.log('\n🎉 初始化完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  管理员: admin / admin123');
  console.log('  测试账户(密码统一 test123):');
  console.log('    boss | factory | warehouse | operator');
  console.log('    aftersales | viewer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
