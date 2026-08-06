import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Dropdown,
  Avatar,
  Breadcrumb,
  Typography,
  Space,
  theme,
  type MenuProps,
} from 'antd';
import {
  DashboardOutlined,
  ShopOutlined,
  DatabaseOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/stores/appStore';
import { useMemo } from 'react';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const allMenuItems = [
  {
    key: '/boss',
    icon: <DashboardOutlined />,
    label: '老板看板',
    roles: ['BOSS', 'ADMIN'],
  },
  {
    key: '/factory',
    icon: <ShopOutlined />,
    label: '工厂管理',
    roles: ['FACTORY_MANAGER', 'ADMIN'],
  },
  {
    key: '/warehouse',
    icon: <DatabaseOutlined />,
    label: '仓库管理',
    roles: ['WAREHOUSE_MANAGER', 'ADMIN'],
  },
  {
    key: '/operation',
    icon: <SettingOutlined />,
    label: '运营管理',
    roles: ['OPERATOR', 'ADMIN'],
  },
  {
    key: '/aftersales',
    icon: <TeamOutlined />,
    label: '售后服务',
    roles: ['AFTERSALES_SPECIALIST', 'ADMIN'],
  },
];

const breadcrumbMap: Record<string, string> = {
  '/boss': '老板看板',
  '/factory': '工厂管理',
  '/warehouse': '仓库管理',
  '/operation': '运营管理',
  '/aftersales': '售后服务',
};

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();
  const user = useAppStore((s) => s.user);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const logout = useAppStore((s) => s.logout);

  const visibleMenuItems = useMemo(
    () =>
      allMenuItems
        .filter((item) => user && item.roles.includes(user.role))
        .map(({ roles: _roles, ...rest }) => rest),
    [user],
  );

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbItems = [
    { title: '首页' },
    ...pathSegments.map((seg) => {
      const path = '/' + seg;
      return { title: breadcrumbMap[path] || seg };
    }),
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'info',
      icon: <UserOutlined />,
      label: `${user.realName}（${user.role}）`,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        theme="dark"
        width={220}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: sidebarCollapsed ? 16 : 20,
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {sidebarCollapsed ? '博纳' : '博纳ERP'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={visibleMenuItems}
          onClick={handleMenuClick}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Dropdown
            menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
            placement="topRight"
          >
            <Space style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.85)' }}>
              <Avatar size="small" icon={<UserOutlined />} />
              {!sidebarCollapsed && (
                <Text style={{ color: 'rgba(255,255,255,0.85)', maxWidth: 120 }} ellipsis>
                  {user.realName}
                </Text>
              )}
            </Space>
          </Dropdown>
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: themeToken.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
          />
          <Breadcrumb items={breadcrumbItems} />
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: themeToken.colorBgContainer,
            borderRadius: themeToken.borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
