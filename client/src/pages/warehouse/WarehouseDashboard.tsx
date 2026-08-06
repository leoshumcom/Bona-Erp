import { Card, Row, Col, Statistic, Table } from 'antd';

const inventoryColumns = [
  { title: 'SKU', dataIndex: 'sku', key: 'sku' },
  { title: '产品名称', dataIndex: 'name', key: 'name' },
  { title: '库存数量', dataIndex: 'quantity', key: 'quantity' },
  { title: '单位成本', dataIndex: 'unitCost', key: 'unitCost' },
  { title: '库存总成本', dataIndex: 'totalCost', key: 'totalCost' },
];

function WarehouseDashboard() {
  return (
    <div>
      <h2>仓库端 - 库存成本管理</h2>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="仓库总数" value={0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="库存SKU数" value={0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="本月入库批次" value={0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="本月仓储费用" value={0} prefix="$" />
          </Card>
        </Col>
      </Row>
      <Card title="库存列表" style={{ marginTop: 24 }}>
        <Table columns={inventoryColumns} dataSource={[]} />
      </Card>
    </div>
  );
}

export default WarehouseDashboard;
