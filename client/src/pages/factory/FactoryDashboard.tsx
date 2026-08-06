import { Card, Row, Col, Statistic, Typography } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const { Title } = Typography;

function FactoryDashboard() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          工厂管理
        </Title>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本月生产订单" value={0} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本月生产成本" value={0} prefix="$" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="模具总数" value={0} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="BOM物料数" value={0} prefix={<ToolOutlined />} />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 24 }}>
        <Typography.Text type="secondary">工厂管理数据看板开发中...</Typography.Text>
      </Card>
    </div>
  );
}

export default FactoryDashboard;
