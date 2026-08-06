import { Card, Row, Col, Statistic, Tabs, Table } from 'antd';

const orderColumns = [
  { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '店铺', dataIndex: 'store', key: 'store' },
  { title: 'SKU', dataIndex: 'sku', key: 'sku' },
  { title: '数量', dataIndex: 'quantity', key: 'quantity' },
  { title: '销售额', dataIndex: 'amount', key: 'amount' },
  { title: '利润', dataIndex: 'profit', key: 'profit' },
];

function OperationDashboard() {
  return (
    <div>
      <h2>运营端 - 店铺运营与利润管理</h2>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="今日销售额" value={0} prefix="$" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="今日订单量" value={0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="广告花费" value={0} prefix="$" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="ACoS" value={0} suffix="%" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="毛利率" value={0} suffix="%" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="净利率" value={0} suffix="%" />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 24 }}>
        <Tabs
          items={[
            { key: 'orders', label: '订单列表', children: <Table columns={orderColumns} dataSource={[]} /> },
            { key: 'ads', label: '广告计划', children: <p>广告管理 - 待开发</p> },
            { key: 'profit', label: '利润报表', children: <p>利润报表 - 待开发</p> },
          ]}
        />
      </Card>
    </div>
  );
}

export default OperationDashboard;
