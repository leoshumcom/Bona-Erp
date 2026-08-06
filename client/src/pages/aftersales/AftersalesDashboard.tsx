import { Card, Row, Col, Statistic, Typography } from 'antd';
import { CustomerServiceOutlined } from '@ant-design/icons';

const { Title } = Typography;

function AftersalesDashboard() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          售后服务
        </Title>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="售后率"
              value={0}
              suffix="%"
              prefix={<CustomerServiceOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="退款率"
              value={0}
              suffix="%"
              prefix={<CustomerServiceOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="本月售后费用"
              value={0}
              prefix="$"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="异常物流"
              value={0}
              prefix={<CustomerServiceOutlined />}
            />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 24 }}>
        <Typography.Text type="secondary">售后服务数据看板开发中...</Typography.Text>
      </Card>
    </div>
  );
}

export default AftersalesDashboard;
