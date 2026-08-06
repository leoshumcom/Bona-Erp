import { Card, Row, Col, Statistic } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, AlertOutlined, PercentageOutlined } from '@ant-design/icons';

function BossDashboard() {
  return (
    <div>
      <h2>老板端 - 全盘经营数据看板</h2>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月总营收"
              value={0}
              prefix={<DollarOutlined />}
              suffix="USD"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月净利润"
              value={0}
              prefix={<DollarOutlined />}
              suffix="USD"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="净利率"
              value={0}
              prefix={<PercentageOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理预警"
              value={0}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
      </Row>
      <Card title="利润趋势" style={{ marginTop: 24 }}>
        <p>图表区域 - 待开发</p>
      </Card>
    </div>
  );
}

export default BossDashboard;
