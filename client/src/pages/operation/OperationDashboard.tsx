import { Card, Row, Col, Statistic, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const { Title } = Typography;

function OperationDashboard() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          运营管理
        </Title>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8} lg={4}>
          <Card>
            <Statistic title="今日销售额" value={0} prefix="$" />
          </Card>
        </Col>
        <Col xs={24} sm={8} lg={4}>
          <Card>
            <Statistic title="今日订单量" value={0} prefix={<SettingOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8} lg={4}>
          <Card>
            <Statistic title="广告花费" value={0} prefix="$" />
          </Card>
        </Col>
        <Col xs={24} sm={8} lg={4}>
          <Card>
            <Statistic title="ACoS" value={0} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} sm={8} lg={4}>
          <Card>
            <Statistic title="毛利率" value={0} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} sm={8} lg={4}>
          <Card>
            <Statistic title="净利率" value={0} suffix="%" />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 24 }}>
        <Typography.Text type="secondary">运营管理数据看板开发中...</Typography.Text>
      </Card>
    </div>
  );
}

export default OperationDashboard;
