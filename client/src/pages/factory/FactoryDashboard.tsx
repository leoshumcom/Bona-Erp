import { Card, Row, Col, Statistic, Table, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const moldColumns = [
  { title: '模具编号', dataIndex: 'moldCode', key: 'moldCode' },
  { title: '对应产品SKU', dataIndex: 'sku', key: 'sku' },
  { title: '开模成本', dataIndex: 'cost', key: 'cost' },
  { title: '使用寿命', dataIndex: 'lifespan', key: 'lifespan' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', key: 'action', render: () => <a>详情</a> },
];

function FactoryDashboard() {
  return (
    <div>
      <h2>工厂端 - 生产成本管理</h2>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="本月生产订单" value={0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="本月生产成本" value={0} prefix="$" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="模具总数" value={0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="BOM物料数" value={0} />
          </Card>
        </Col>
      </Row>
      <Card
        title="模具管理"
        style={{ marginTop: 24 }}
        extra={<Button type="primary" icon={<PlusOutlined />}>新增模具</Button>}
      >
        <Table columns={moldColumns} dataSource={[]} />
      </Card>
    </div>
  );
}

export default FactoryDashboard;
