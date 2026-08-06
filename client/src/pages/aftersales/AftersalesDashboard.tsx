import { Card, Row, Col, Statistic, Tabs, Table } from 'antd';

const afterSalesColumns = [
  { title: '售后单号', dataIndex: 'id', key: 'id' },
  { title: '关联订单', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '损失金额', dataIndex: 'loss', key: 'loss' },
];

function AftersalesDashboard() {
  return (
    <div>
      <h2>售后端 - 物流售后管理</h2>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="售后率" value={0} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="退款率" value={0} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="本月售后费用" value={0} prefix="$" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="异常物流" value={0} />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 24 }}>
        <Tabs
          items={[
            { key: 'aftersales', label: '售后工单', children: <Table columns={afterSalesColumns} dataSource={[]} /> },
            { key: 'logistics', label: '物流跟踪', children: <p>物流管理 - 待开发</p> },
          ]}
        />
      </Card>
    </div>
  );
}

export default AftersalesDashboard;
