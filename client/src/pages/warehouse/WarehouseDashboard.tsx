import { Card, Row, Col, Statistic, Typography } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const { Title } = Typography;

function WarehouseDashboard() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          仓库管理
        </Title>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="仓库总数" value={0} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="库存SKU数" value={0} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本月入库批次" value={0} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本月仓储费用" value={0} prefix="$" />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 24 }}>
        <Typography.Text type="secondary">仓库管理数据看板开发中...</Typography.Text>
      </Card>
    </div>
  );
}

export default WarehouseDashboard;
