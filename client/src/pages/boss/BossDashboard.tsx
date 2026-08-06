import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  PercentageOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import api from '@/services/api';

const { Title } = Typography;

interface Snapshot {
  todayRevenue?: number;
  todayOrders?: number;
  netProfitRate?: number;
  inventoryValue?: number;
}

function BossDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot>({});

  useEffect(() => {
    api
      .get('/api/boss/dashboard/snapshot')
      .then(({ data }) => setSnapshot(data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          老板看板
        </Title>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日营收"
              value={snapshot.todayRevenue ?? 0}
              prefix={<DollarOutlined />}
              suffix="USD"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日订单"
              value={snapshot.todayOrders ?? 0}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="净利润率"
              value={snapshot.netProfitRate ?? 0}
              prefix={<PercentageOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="库存总价值"
              value={snapshot.inventoryValue ?? 0}
              prefix={<DatabaseOutlined />}
              suffix="USD"
            />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 24 }}>
        <Typography.Text type="secondary">数据看板开发中...</Typography.Text>
      </Card>
    </div>
  );
}

export default BossDashboard;
