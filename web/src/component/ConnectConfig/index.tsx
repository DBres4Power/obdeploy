import { intl } from '@/utils/intl';
import { ProForm, ProCard } from '@ant-design/pro-components';
import {
  Input,
  Space,
  Tooltip,
  Button,
  InputNumber,
  message,
  Modal,
} from 'antd';
import { QuestionCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useModel } from 'umi';

import * as Metadb from '@/services/ocp_installer_backend/Metadb';
import CustomFooter from '../CustomFooter';
import InputPort from '../InputPort';
import ExitBtn from '../ExitBtn';
import styles from './index.less';
const InputWidthStyle = { width: 328 };

type FormValues = {
  metadb: {
    host: string;
    port: number;
    user: string;
    password: string;
  };
};

export default function ConnectConfig({ setCurrent, current }: API.StepProp) {
  const { ocpConfigData, setOcpConfigData, setErrorVisible, setErrorsList } =
    useModel('global');
  const { components = {} } = ocpConfigData;
  const { ocpserver = {}, oceanbase = {} } = components;
  const { metadb = {} } = ocpserver;
  const cluster_name = oceanbase?.appname;
  const { host, port, user, password } = metadb;
  const [form] = ProForm.useForm();
  const setData = (dataSource: FormValues) => {
    let newOcpserver = {
      ...ocpserver,
      ...dataSource,
    };
    setOcpConfigData({
      ...ocpConfigData,
      components: {
        ...components,
        ocpserver: newOcpserver,
      },
    });
  };
  // 通过 connection 方式创建一个 metadb 连接
  const { run: createMetadbConnection, loading } = useRequest(
    Metadb.createMetadbConnection,
    {
      manual: true,
      onError: ({ data }: any) => {
        const errorInfo =
          data?.detail?.msg || (data?.detail[0] && data?.detail[0]?.msg);
        Modal.error({
          title: intl.formatMessage({
            id: 'OBD.component.ConnectConfig.MetadbConnectionFailedPleaseCheck',
            defaultMessage: 'MetaDB 连接失败，请检查连接配置',
          }),
          icon: <CloseCircleOutlined />,
          content: errorInfo,
          okText: intl.formatMessage({
            id: 'OBD.component.ConnectConfig.IKnow',
            defaultMessage: '我知道了',
          }),
        });
      },
    },
  );

  const nextStep = () => {
    form
      .validateFields()
      .then((values) => {
        const { host, port, user, password } = values.metadb;
        createMetadbConnection(
          { sys: true },
          {
            host,
            port,
            user,
            password,
            cluster_name,
          },
        ).then(() => {
          setData(values);
          setCurrent(current + 1);
          setErrorVisible(false);
          setErrorsList([]);
          window.scrollTo(0, 0);
        });
      })
      .catch(({ errorFields }) => {
        const errorName = errorFields?.[0].name;
        form.scrollToField(errorName);
        message.destroy();
      });
  };
  const prevStep = () => {
    setCurrent(current - 1);
  };
  const initialValues: FormValues = {
    metadb: {
      host: host || undefined,
      port: port || undefined,
      user: user || 'root@sys',
      password: password || undefined,
    },
  };
  return (
    <Space style={{ width: '100%' }} direction="vertical" size="middle">
      <ProCard>
        <p className={styles.titleText}>
          {intl.formatMessage({
            id: 'OBD.component.ConnectConfig.ConnectionInformation',
            defaultMessage: '连接信息',
          })}
        </p>
        <ProForm
          form={form}
          submitter={false}
          validateTrigger={['onBlur', 'onChange']}
          initialValues={initialValues}
        >
          <ProForm.Item
            name={['metadb', 'host']}
            label={intl.formatMessage({
              id: 'OBD.component.ConnectConfig.HostIp',
              defaultMessage: '主机 IP',
            })}
            style={InputWidthStyle}
            rules={[
              {
                required: true,
                message: intl.formatMessage({
                  id: 'OBD.component.ConnectConfig.EnterTheHostIpAddress',
                  defaultMessage: '请输入主机 IP',
                }),
              },
              {
                pattern: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
                message: intl.formatMessage({
                  id: 'OBD.component.ConnectConfig.TheHostIpAddressFormat',
                  defaultMessage: '主机IP格式不正确',
                }),
              },
            ]}
          >
            <Input
              placeholder={intl.formatMessage({
                id: 'OBD.component.ConnectConfig.EnterADatabaseAccessIp',
                defaultMessage: '请输入数据库访问 IP 地址',
              })}
            />
          </ProForm.Item>
          <InputPort
            name={['metadb', 'port']}
            label={intl.formatMessage({
              id: 'OBD.component.ConnectConfig.AccessPort',
              defaultMessage: '访问端口',
            })}
            message={intl.formatMessage({
              id: 'OBD.component.ConnectConfig.EnterAnAccessPort',
              defaultMessage: '请输入访问端口',
            })}
            fieldProps={{ style: InputWidthStyle }}
          />
          <ProForm.Item
            name={['metadb', 'user']}
            label={intl.formatMessage({
              id: 'OBD.component.ConnectConfig.AccessAccount',
              defaultMessage: '访问账号',
            })}
            style={InputWidthStyle}
            rules={[
              {
                required: true,
                message: intl.formatMessage({
                  id: 'OBD.component.ConnectConfig.EnterAnAccessAccount',
                  defaultMessage: '请输入访问账号',
                }),
              },
            ]}
          >
            <Input placeholder="root@sys" />
          </ProForm.Item>
          <ProForm.Item
            label={
              <>
                {intl.formatMessage({
                  id: 'OBD.component.ConnectConfig.AccessPassword',
                  defaultMessage: '访问密码',
                })}

                <Tooltip
                  title={intl.formatMessage({
                    id: 'OBD.component.ConnectConfig.OcpPlatformAdministratorAccountPassword',
                    defaultMessage: 'OCP 平台管理员账号密码',
                  })}
                >
                  <QuestionCircleOutlined className="ml-10" />
                </Tooltip>
              </>
            }
            name={['metadb', 'password']}
            rules={[
              {
                required: true,
                message: intl.formatMessage({
                  id: 'OBD.component.ConnectConfig.EnterAnAccessPassword',
                  defaultMessage: '请输入访问密码',
                }),
              },
            ]}
            style={InputWidthStyle}
          >
            <Input.Password
              placeholder={intl.formatMessage({
                id: 'OBD.component.ConnectConfig.PleaseEnter',
                defaultMessage: '请输入',
              })}
            />
          </ProForm.Item>
        </ProForm>
      </ProCard>
      <CustomFooter>
        <ExitBtn />
        <Button onClick={prevStep}>
          {intl.formatMessage({
            id: 'OBD.component.ConnectConfig.PreviousStep',
            defaultMessage: '上一步',
          })}
        </Button>
        <Button type="primary" loading={loading} onClick={nextStep}>
          {intl.formatMessage({
            id: 'OBD.component.ConnectConfig.NextStep',
            defaultMessage: '下一步',
          })}
        </Button>
      </CustomFooter>
    </Space>
  );
}
