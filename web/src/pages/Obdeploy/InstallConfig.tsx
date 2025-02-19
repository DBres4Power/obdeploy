import { intl } from '@/utils/intl';
import { useEffect, useState, useRef } from 'react';
import { useModel, history } from 'umi';
import {
  Space,
  Button,
  Form,
  Tag,
  Table,
  Alert,
  Tooltip,
  Select,
  Modal,
  Spin,
  message,
} from 'antd';
import { ProCard, ProForm, ProFormText } from '@ant-design/pro-components';
import {
  CloseOutlined,
  SafetyCertificateFilled,
  InfoOutlined,
  InfoCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import useRequest from '@/utils/useRequest';
import { queryAllComponentVersions } from '@/services/ob-deploy-web/Components';
import {
  getDeployment,
  destroyDeployment,
} from '@/services/ob-deploy-web/Deployments';
import { listRemoteMirrors } from '@/services/ob-deploy-web/Mirror';
import { handleQuit, checkLowVersion, getErrorInfo } from '@/utils';
import NP from 'number-precision';
import copy from 'copy-to-clipboard';
import DeployType from './DeployType';
import DeleteDeployModal from './DeleteDeployModal';
import ErrorCompToolTip from '@/component/ErrorCompToolTip';
import {
  commonStyle,
  allComponentsName,
  oceanbaseComponent,
  obproxyComponent,
  ocpexpressComponent,
  obagentComponent,
} from '../constants';
import { getLocale } from 'umi';
import { clusterNameReg } from '@/utils';
import EnStyles from './indexEn.less';
import ZhStyles from './indexZh.less';

type rowDataType = {
  key: string;
  name: string;
  onlyAll: boolean;
  desc: string;
  doc: string;
};

const locale = getLocale();
const styles = locale === 'zh-CN' ? ZhStyles : EnStyles;
const appnameReg = /^[a-zA-Z]([a-zA-Z0-9]{0,19})$/;

const oceanBaseInfo = {
  group: intl.formatMessage({
    id: 'OBD.pages.components.InstallConfig.Database',
    defaultMessage: '数据库',
  }),
  key: 'database',
  content: [
    {
      key: oceanbaseComponent,
      name: 'OceanBase Database',
      onlyAll: false,
      desc: intl.formatMessage({
        id: 'OBD.pages.components.InstallConfig.ItIsAFinancialLevel',
        defaultMessage:
          '是金融级分布式数据库，具备数据强一致、高扩展、高可用、高性价比、稳定可靠等特征。',
      }),
      doc: 'https://www.oceanbase.com/docs/oceanbase-database-cn',
    },
  ],
};
const componentsGroupInfo = [
  {
    group: intl.formatMessage({
      id: 'OBD.pages.components.InstallConfig.Proxy',
      defaultMessage: '代理',
    }),
    key: 'agency',
    onlyAll: true,
    content: [
      {
        key: obproxyComponent,
        name: 'OBProxy',
        onlyAll: true,
        desc: intl.formatMessage({
          id: 'OBD.pages.components.InstallConfig.ItIsAProxyServer',
          defaultMessage:
            '是 OceanBase 数据库专用的代理服务器，可以将用户 SQL 请求转发至最佳目标 OBServer 。',
        }),
        doc: 'https://www.oceanbase.com/docs/odp-enterprise-cn',
      },
    ],
  },
  {
    group: intl.formatMessage({
      id: 'OBD.pages.components.InstallConfig.Tools',
      defaultMessage: '工具',
    }),
    key: 'ocpexpressTool',
    onlyAll: true,
    content: [
      {
        key: ocpexpressComponent,
        name: 'OCP Express',
        onlyAll: true,
        desc: intl.formatMessage({
          id: 'OBD.pages.components.InstallConfig.ItIsAManagementAnd',
          defaultMessage:
            '是专为 OceanBase 设计的管控平台，可实现对集群、租户的监控管理、诊断等核心能力。',
        }),
        doc: 'https://www.oceanbase.com/docs/common-oceanbase-database-cn-0000000001626262',
      },
    ],
  },
  {
    group: intl.formatMessage({
      id: 'OBD.pages.components.InstallConfig.Tools',
      defaultMessage: '工具',
    }),
    key: 'obagentTool',
    onlyAll: true,
    content: [
      {
        key: obagentComponent,
        name: 'OBAgent',
        onlyAll: true,
        desc: intl.formatMessage({
          id: 'OBD.pages.components.InstallConfig.IsAMonitoringAndCollection',
          defaultMessage:
            '是一个监控采集框架。OBAgent 支持推、拉两种数据采集模式，可以满足不同的应用场景。',
        }),
        doc: 'https://www.oceanbase.com/docs/common-oceanbase-database-cn-10000000001576872',
      },
    ],
  },
];

const mirrors = ['oceanbase.community.stable', 'oceanbase.development-kit'];

export default function InstallConfig() {
  const {
    initAppName,
    setCurrentStep,
    configData,
    setConfigData,
    lowVersion,
    isFirstTime,
    setIsFirstTime,
    isDraft,
    setIsDraft,
    componentsVersionInfo,
    setComponentsVersionInfo,
    handleQuitProgress,
    getInfoByName,
    setLowVersion,
    setErrorVisible,
    errorsList,
    setErrorsList,
    selectedConfig,
    setSelectedConfig,
    aliveTokenTimer,
  } = useModel('global');
  const { components, home_path } = configData || {};
  const { oceanbase } = components || {};
  const [existNoVersion, setExistNoVersion] = useState(false);
  const [obVersionValue, setOBVersionValue] = useState<string | undefined>(
    undefined,
  );

  const [hasDraft, setHasDraft] = useState(false);
  const [deleteLoadingVisible, setDeleteLoadingVisible] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  const [deployMemory, setDeployMemory] = useState(0);
  const [componentsMemory, setComponentsMemory] = useState(0);
  const [form] = ProForm.useForm();
  const [unavailableList, setUnavailableList] = useState<string[]>([]);
  const [componentLoading, setComponentLoading] = useState(false);
  const draftNameRef = useRef();

  const { run: fetchDeploymentInfo, loading } = useRequest(getDeployment, {
    onError: (e: any) => {
      const errorInfo = getErrorInfo(e);
      setErrorVisible(true);
      setErrorsList([...errorsList, errorInfo]);
    },
  });
  const { run: handleDeleteDeployment } = useRequest(destroyDeployment, {
    onError: (e: any) => {
      const errorInfo = getErrorInfo(e);
      setErrorVisible(true);
      setErrorsList([...errorsList, errorInfo]);
    },
  });
  const { run: fetchListRemoteMirrors } = useRequest(listRemoteMirrors, {
    onSuccess: () => {
      setComponentLoading(false);
    },
    onError: ({ response, data, type }: any) => {
      if (response?.status === 503) {
        setTimeout(() => {
          fetchListRemoteMirrors();
        }, 1000);
      } else {
        const errorInfo = getErrorInfo({ response, data, type });
        setErrorVisible(true);
        setErrorsList([...errorsList, errorInfo]);
        setComponentLoading(false);
      }
    },
  });

  const judgVersions = (source: API.ComponentsVersionInfo) => {
    if (Object.keys(source).length !== allComponentsName.length) {
      setExistNoVersion(true);
    } else {
      setExistNoVersion(false);
    }
  };

  const { run: fetchAllComponentVersions, loading: versionLoading } =
    useRequest(queryAllComponentVersions, {
      onSuccess: async ({
        success,
        data,
      }: API.OBResponseDataListComponent_) => {
        if (success) {
          const newComponentsVersionInfo = {};
          const oceanbaseVersionsData = data?.items?.filter(
            (item) => item.name === oceanbaseComponent,
          );

          const initOceanbaseVersionInfo =
            oceanbaseVersionsData[0]?.info[0] || {};
          const newSelectedOceanbaseVersionInfo =
            oceanbaseVersionsData[0]?.info?.filter(
              (item) => item.md5 === oceanbase?.package_hash,
            )?.[0];

          const currentOceanbaseVersionInfo =
            newSelectedOceanbaseVersionInfo || initOceanbaseVersionInfo;

          data?.items?.forEach((item) => {
            if (allComponentsName.includes(item.name)) {
              if (item?.info?.length) {
                const initVersionInfo = item?.info[0] || {};
                if (item.name === oceanbaseComponent) {
                  setOBVersionValue(
                    `${currentOceanbaseVersionInfo?.version}-${currentOceanbaseVersionInfo?.release}-${currentOceanbaseVersionInfo?.md5}`,
                  );
                  newComponentsVersionInfo[item.name] = {
                    ...currentOceanbaseVersionInfo,
                    dataSource: item.info || [],
                  };
                } else if (item.name === obproxyComponent) {
                  let currentObproxyVersionInfo = {};
                  item?.info?.some((subItem) => {
                    if (
                      subItem?.version_type ===
                      currentOceanbaseVersionInfo?.version_type
                    ) {
                      currentObproxyVersionInfo = subItem;
                      return true;
                    }
                    return false;
                  });
                  newComponentsVersionInfo[item.name] = {
                    ...currentObproxyVersionInfo,
                    dataSource: item.info || [],
                  };
                } else {
                  newComponentsVersionInfo[item.name] = {
                    ...initVersionInfo,
                    dataSource: item.info || [],
                  };
                }
              }
            }
          });

          const noVersion =
            Object.keys(newComponentsVersionInfo).length !==
            allComponentsName.length;
          judgVersions(newComponentsVersionInfo);
          setComponentsVersionInfo(newComponentsVersionInfo);

          if (noVersion) {
            const { success: mirrorSuccess, data: mirrorData } =
              await fetchListRemoteMirrors();
            if (mirrorSuccess) {
              const nameList: string[] = [];
              if (mirrorData?.total < 2) {
                const mirrorName = mirrorData?.items?.map(
                  (item: API.Mirror) => item.section_name,
                );

                const noDataName = [...mirrorName, ...mirrors].filter(
                  (name) =>
                    mirrors.includes(name) && !mirrorName.includes(name),
                );

                noDataName.forEach((name) => {
                  nameList.push(name);
                });
              }
              if (mirrorData?.total) {
                mirrorData?.items?.forEach((item: API.Mirror) => {
                  if (!item.available) {
                    nameList.push(item.section_name);
                  }
                });
              }
              setUnavailableList(nameList);
            }
          } else {
            setComponentLoading(false);
          }
        }
      },
      onError: ({ response, data, type }: any) => {
        if (response?.status === 503) {
          setTimeout(() => {
            fetchAllComponentVersions();
          }, 1000);
        } else {
          const errorInfo = getErrorInfo({ response, data, type });
          setErrorVisible(true);
          setErrorsList([...errorsList, errorInfo]);
          setComponentLoading(false);
        }
      },
    });

  const nameValidator = async (_: any, value: string) => {
    if (value) {
      if (hasDraft || isDraft) {
        return Promise.resolve();
      }
      if (!clusterNameReg.test(value)) {
        return Promise.reject(
          new Error(
            intl.formatMessage({
              id: 'OBD.pages.Obdeploy.InstallConfig.ItStartsWithALetter',
              defaultMessage:
                '以英文字母开头、英文或数字结尾，可包含英文、数字和下划线，且长度为 2 ~ 32',
            }),
          ),
        );
      }
      try {
        const { success, data } = await getInfoByName({ name: value });
        if (success) {
          if (['CONFIGURED', 'DESTROYED'].includes(data?.status)) {
            return Promise.resolve();
          }
          return Promise.reject(
            new Error(
              intl.formatMessage(
                {
                  id: 'OBD.pages.components.InstallConfig.ADeploymentNameWithValue',
                  defaultMessage: '已存在为 {value} 的部署名称，请指定新名称',
                },
                { value: value },
              ),
            ),
          );
        }
        return Promise.resolve();
      } catch ({ response, data, type }: any) {
        if (response?.status === 404) {
          return Promise.resolve();
        } else {
          const errorInfo = getErrorInfo({ response, data, type });
          setErrorVisible(true);
          setErrorsList([...errorsList, errorInfo]);
        }
      }
    }
  };

  const preStep = () => {
    if (aliveTokenTimer.current) {
      clearTimeout(aliveTokenTimer.current);
      aliveTokenTimer.current = null;
    }
    history.push('guide');
  };

  const nextStep = () => {
    if (form.getFieldsError(['appname'])[0].errors.length) return;
    form.validateFields().then((values) => {
      const lastAppName = oceanbase?.appname || initAppName;
      let newHomePath = home_path;
      if (values?.appname !== lastAppName && home_path) {
        const firstHalfHomePath = home_path.split(`/${lastAppName}`)[0];
        newHomePath = `${firstHalfHomePath}/${values?.appname}`;
      }
      let newComponents: API.Components = {
        oceanbase: {
          ...(components?.oceanbase || {}),
          component:
            componentsVersionInfo?.[oceanbaseComponent]?.version_type === 'ce'
              ? 'oceanbase-ce'
              : 'oceanbase',
          appname: values?.appname,
          version: componentsVersionInfo?.[oceanbaseComponent]?.version,
          release: componentsVersionInfo?.[oceanbaseComponent]?.release,
          package_hash: componentsVersionInfo?.[oceanbaseComponent]?.md5,
        },
      };
      if (selectedConfig.includes('obproxy')) {
        newComponents.obproxy = {
          ...(components?.obproxy || {}),
          component:
            componentsVersionInfo?.[obproxyComponent]?.version_type === 'ce'
              ? 'obproxy-ce'
              : 'obproxy',
          version: componentsVersionInfo?.[obproxyComponent]?.version,
          release: componentsVersionInfo?.[obproxyComponent]?.release,
          package_hash: componentsVersionInfo?.[obproxyComponent]?.md5,
        };
      }
      if (selectedConfig.includes('obagent')) {
        newComponents.obagent = {
          ...(components?.obagent || {}),
          component: obagentComponent,
          version: componentsVersionInfo?.[obagentComponent]?.version,
          release: componentsVersionInfo?.[obagentComponent]?.release,
          package_hash: componentsVersionInfo?.[obagentComponent]?.md5,
        };
      }
      if (!lowVersion && selectedConfig.includes('ocp-express')) {
        newComponents.ocpexpress = {
          ...(components?.ocpexpress || {}),
          component: ocpexpressComponent,
          version: componentsVersionInfo?.[ocpexpressComponent]?.version,
          release: componentsVersionInfo?.[ocpexpressComponent]?.release,
          package_hash: componentsVersionInfo?.[ocpexpressComponent]?.md5,
        };
      }

      setConfigData({
        ...configData,
        components: newComponents,
        home_path: newHomePath,
      });
      setCurrentStep(2);
      setIsFirstTime(false);
      setErrorVisible(false);
      setErrorsList([]);
      window.scrollTo(0, 0);
    });
  };

  const onVersionChange = (
    value: string,
    dataSource: API.service_model_components_ComponentInfo[],
  ) => {
    const md5 = value.split('-')[2];
    setOBVersionValue(value);
    const newSelectedVersionInfo = dataSource.filter(
      (item) => item.md5 === md5,
    )[0];

    let currentObproxyVersionInfo = {};
    componentsVersionInfo?.[obproxyComponent]?.dataSource?.some(
      (item: API.service_model_components_ComponentInfo) => {
        if (item?.version_type === newSelectedVersionInfo?.version_type) {
          currentObproxyVersionInfo = item;
          return true;
        }
        return false;
      },
    );
    setComponentsVersionInfo({
      ...componentsVersionInfo,
      [oceanbaseComponent]: {
        ...componentsVersionInfo[oceanbaseComponent],
        ...newSelectedVersionInfo,
      },
      [obproxyComponent]: {
        ...componentsVersionInfo[obproxyComponent],
        ...currentObproxyVersionInfo,
      },
    });
    setLowVersion(
      !!(
        newSelectedVersionInfo.version &&
        checkLowVersion(newSelectedVersionInfo.version.split('')[0])
      ),
    );
  };

  const directTo = (url: string) => {
    const blankWindow = window.open('about:blank');
    if (blankWindow) {
      blankWindow.location.href = url;
    } else {
      window.location.href = url;
    }
  };

  const getColumns = (group: string, supportCheckbox: boolean) => {
    const columns: ColumnsType<API.TableComponentInfo> = [
      {
        title: group,
        dataIndex: 'name',
        width: supportCheckbox ? 147 : 195,
        render: (text, record) => {
          return (
            <>
              {text}
              {record.key === ocpexpressComponent && lowVersion ? (
                <ErrorCompToolTip
                  title={intl.formatMessage({
                    id: 'OBD.pages.Obdeploy.InstallConfig.OcpExpressOnlySupportsAnd',
                    defaultMessage:
                      'OCP Express 仅支持 4.0 及以上版本 OceanBase Database。',
                  })}
                  status="warning"
                />
              ) : !componentsVersionInfo[record.key]?.version ? (
                <ErrorCompToolTip
                  title={intl.formatMessage({
                    id: 'OBD.pages.Obdeploy.InstallConfig.UnableToObtainTheInstallation',
                    defaultMessage: '无法获取安装包，请检查安装程序配置。',
                  })}
                  status="error"
                />
              ) : null}
            </>
          );
        },
      },
      {
        title: intl.formatMessage({
          id: 'OBD.pages.components.InstallConfig.Version',
          defaultMessage: '版本',
        }),
        dataIndex: 'version',
        width: locale === 'zh-CN' ? 130 : 154,
        render: (_, record) => {
          const versionInfo = componentsVersionInfo[record.key] || {};
          if (record?.key === oceanbaseComponent) {
            return (
              <Select
                value={obVersionValue}
                optionLabelProp="data_value"
                style={{ width: 100 }}
                onChange={(value) =>
                  onVersionChange(value, versionInfo?.dataSource)
                }
                popupClassName={styles?.popupClassName}
              >
                {versionInfo?.dataSource?.map(
                  (item: API.service_model_components_ComponentInfo) => (
                    <Select.Option
                      value={`${item.version}-${item?.release}-${item.md5}`}
                      data_value={item.version}
                      key={`${item.version}-${item?.release}-${item.md5}`}
                    >
                      {item.version}
                      {item?.release ? `-${item?.release}` : ''}
                      {item.version_type === 'ce' ? (
                        <Tag className="default-tag ml-8">
                          {intl.formatMessage({
                            id: 'OBD.pages.components.InstallConfig.CommunityEdition',
                            defaultMessage: '社区版',
                          })}
                        </Tag>
                      ) : (
                        <Tag className="blue-tag ml-8">
                          {intl.formatMessage({
                            id: 'OBD.pages.components.InstallConfig.CommercialEdition',
                            defaultMessage: '商业版',
                          })}
                        </Tag>
                      )}

                      {item?.type === 'local' ? (
                        <span className={styles.localTag}>
                          <SafetyCertificateFilled />
                          {intl.formatMessage({
                            id: 'OBD.pages.components.InstallConfig.LocalImage',
                            defaultMessage: '本地镜像',
                          })}
                        </span>
                      ) : (
                        ''
                      )}
                    </Select.Option>
                  ),
                )}
              </Select>
            );
          } else {
            return versionInfo?.version ? (
              <>
                {versionInfo?.version}
                <Tag className="default-tag ml-8">
                  {intl.formatMessage({
                    id: 'OBD.pages.components.InstallConfig.Latest',
                    defaultMessage: '最新',
                  })}
                </Tag>
              </>
            ) : (
              '-'
            );
          }
        },
      },
      {
        title: intl.formatMessage({
          id: 'OBD.pages.components.InstallConfig.Description',
          defaultMessage: '描述',
        }),
        dataIndex: 'desc',
        render: (text, record) => {
          let disabled = false;
          if (record.key === ocpexpressComponent && lowVersion) {
            disabled = true;
          }
          return (
            <>
              {text || '-'}
              <a
                className={styles.learnMore}
                onClick={() => {
                  if (!disabled) directTo(record.doc);
                }}
                target="_blank"
              >
                {intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.LearnMore',
                  defaultMessage: '了解更多',
                })}
              </a>
            </>
          );
        },
      },
    ];

    return columns;
  };

  const handleCopy = (content: string) => {
    copy(content);
    message.success(
      intl.formatMessage({
        id: 'OBD.pages.components.InstallConfig.CopiedSuccessfully',
        defaultMessage: '复制成功',
      }),
    );
  };

  /**
   * tip:如果选择OCP Express，则OBAgent则自动选择，无需提示
   * 如果不选择 OBAgent, 则 OCP Express 则自动不选择，无需提示
   */
  const handleSelect = (record: rowDataType, selected: boolean) => {
    if (!selected) {
      let newConfig = [],
        target = false;
      target =
        record.key === 'obagent' && selectedConfig.includes('ocp-express');
      for (let val of selectedConfig) {
        if (target && val === 'ocp-express') continue;
        if (val !== record.key) {
          newConfig.push(val);
        }
      }
      setSelectedConfig(newConfig);
    } else {
      if (record.key === 'ocp-express' && !selectedConfig.includes('obagent')) {
        setSelectedConfig([...selectedConfig, record.key, 'obagent']);
      } else {
        setSelectedConfig([...selectedConfig, record.key]);
      }
    }
  };

  const caculateSize = (originSize: number): string => {
    return NP.divide(NP.divide(originSize, 1024), 1024).toFixed(2);
  };

  useEffect(() => {
    setComponentLoading(true);
    if (isFirstTime) {
      fetchAllComponentVersions();
      fetchDeploymentInfo({ task_status: 'DRAFT' }).then(
        ({ success: draftSuccess, data: draftData }: API.OBResponse) => {
          if (draftSuccess && draftData?.items?.length) {
            const defaultValue = draftData?.items[0]?.name;
            draftNameRef.current = defaultValue;
            setHasDraft(true);
            Modal.confirm({
              title: intl.formatMessage({
                id: 'OBD.pages.components.InstallConfig.TheFollowingHistoricalConfigurationsOf',
                defaultMessage: '检测到系统中存在以下部署失败的历史配置',
              }),
              okText: intl.formatMessage({
                id: 'OBD.pages.components.InstallConfig.ContinueDeployment',
                defaultMessage: '继续部署',
              }),
              cancelText: intl.formatMessage({
                id: 'OBD.pages.components.InstallConfig.Ignore',
                defaultMessage: '忽略',
              }),
              closable: true,
              width: 424,
              content: (
                <Space direction="vertical" size="middle">
                  <div style={{ color: '#5C6B8A' }}>
                    {intl.formatMessage({
                      id: 'OBD.pages.components.InstallConfig.ContinuingDeploymentWillCleanUp',
                      defaultMessage:
                        '继续部署将先清理失败的历史部署环境，是否继续历史部署流程？',
                    })}
                  </div>
                  <Select
                    style={commonStyle}
                    onChange={(value) => (draftNameRef.current = value)}
                    defaultValue={defaultValue}
                  >
                    {draftData?.items?.map((item) => (
                      <Select.Option key={item.name} value={item.name}>
                        {item.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Space>
              ),

              onOk: () => {
                return new Promise<void>(async (resolve) => {
                  try {
                    const { success: deleteSuccess } =
                      await handleDeleteDeployment({
                        name: draftNameRef.current,
                      });
                    if (deleteSuccess) {
                      resolve();
                      setDeleteName(draftNameRef.current);
                      setDeleteLoadingVisible(true);
                    }
                  } catch {
                    setIsDraft(false);
                    resolve();
                  }
                });
              },
              onCancel: () => {
                setIsDraft(false);
                setHasDraft(false);
              },
            });
          } else {
            setIsDraft(false);
          }
        },
      );
    } else {
      fetchAllComponentVersions();
    }
  }, []);

  useEffect(() => {
    let deployMemory: number =
      componentsVersionInfo?.[oceanbaseComponent]?.estimated_size || 0;
    let componentsMemory: number = 0;
    const keys = Object.keys(componentsVersionInfo);
    keys.forEach((key) => {
      if (key !== 'oceanbaseComponent' && selectedConfig.includes(key)) {
        componentsMemory += componentsVersionInfo[key]?.estimated_size;
      }
    });
    setDeployMemory(deployMemory);
    setComponentsMemory(componentsMemory);
  }, [componentsVersionInfo, selectedConfig]);

  useEffect(() => {
    form.setFieldsValue({
      appname: configData?.components?.oceanbase?.appname || initAppName,
    });
  }, [configData]);

  return (
    <Spin spinning={loading || componentLoading}>
      <Space className={styles.spaceWidth} direction="vertical" size="middle">
        <ProCard className={styles.pageCard} split="horizontal">
          <ProCard
            title={intl.formatMessage({
              id: 'OBD.pages.components.InstallConfig.DeploymentConfiguration',
              defaultMessage: '部署配置',
            })}
            className="card-padding-bottom-24"
          >
            <ProForm
              form={form}
              submitter={false}
              initialValues={{
                appname: oceanbase?.appname || initAppName,
              }}
            >
              <ProFormText
                name="appname"
                label={intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.ClusterName',
                  defaultMessage: '集群名称',
                })}
                fieldProps={{ style: commonStyle }}
                placeholder={intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.EnterAClusterName',
                  defaultMessage: '请输入集群名称',
                })}
                validateTrigger={['onBlur', 'onChange']}
                disabled={isDraft}
                rules={[
                  {
                    required: true,
                    message: intl.formatMessage({
                      id: 'OBD.pages.components.InstallConfig.EnterAClusterName',
                      defaultMessage: '请输入集群名称',
                    }),
                    validateTrigger: 'onChange',
                  },
                  {
                    pattern: clusterNameReg,
                    message: intl.formatMessage({
                      id: 'OBD.pages.Obdeploy.InstallConfig.ItStartsWithALetter',
                      defaultMessage:
                        '以英文字母开头、英文或数字结尾，可包含英文、数字和下划线，且长度为 2 ~ 32',
                    }),

                    validateTrigger: 'onChange',
                  },
                  { validator: nameValidator, validateTrigger: 'onBlur' },
                ]}
              />
            </ProForm>
          </ProCard>
          <ProCard
            title={
              <>
                {intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.DeployComponents',
                  defaultMessage: '部署组件',
                })}

                <span className={styles.titleExtra}>
                  <InfoCircleOutlined />{' '}
                  {intl.formatMessage(
                    {
                      id: 'OBD.pages.components.InstallConfig.EstimatedInstallationRequiresSizeMb',
                      defaultMessage: '预计安装需要 {size}MB 空间',
                    },
                    { size: caculateSize(deployMemory) },
                  )}
                </span>
              </>
            }
            className="card-header-padding-top-0 card-padding-bottom-24  card-padding-top-0"
          >
            <Space
              className={styles.spaceWidth}
              direction="vertical"
              size="middle"
            >
              {existNoVersion ? (
                unavailableList?.length ? (
                  <Alert
                    message={
                      <>
                        {intl.formatMessage({
                          id: 'OBD.pages.components.InstallConfig.IfTheCurrentEnvironmentCannot',
                          defaultMessage:
                            '如当前环境无法正常访问外网，建议使用 OceanBase 离线安装包进行安装部署。',
                        })}
                        <a
                          href="https://open.oceanbase.com/softwareCenter/community"
                          target="_blank"
                        >
                          {intl.formatMessage({
                            id: 'OBD.pages.components.InstallConfig.GoToDownloadOfflineInstallation',
                            defaultMessage: '前往下载离线安装',
                          })}
                        </a>
                      </>
                    }
                    type="error"
                    showIcon
                    style={{ marginTop: '16px' }}
                  />
                ) : (
                  <Alert
                    message={
                      <>
                        {intl.formatMessage({
                          id: 'OBD.pages.components.InstallConfig.IfTheCurrentEnvironmentHas',
                          defaultMessage:
                            '如当前环境可正常访问外网，可启动 OceanBase 在线镜像仓库，或联系您的镜像仓库管理员。',
                        })}
                        <Tooltip
                          overlayClassName={styles.commandTooltip}
                          title={
                            <div>
                              {intl.formatMessage({
                                id: 'OBD.pages.components.InstallConfig.RunTheCommandOnThe',
                                defaultMessage:
                                  '请在主机上执行一下命令启用在线镜像仓库',
                              })}
                              <br /> obd mirror enable
                              oceanbase.community.stable
                              oceanbase.development-kit
                              <a>
                                <CopyOutlined
                                  onClick={() =>
                                    handleCopy(
                                      'obd mirror enable oceanbase.community.stable oceanbase.development-kit',
                                    )
                                  }
                                />
                              </a>
                            </div>
                          }
                        >
                          <a>
                            {intl.formatMessage({
                              id: 'OBD.pages.components.InstallConfig.HowToEnableOnlineImage',
                              defaultMessage: '如何启用在线镜像仓库',
                            })}
                          </a>
                        </Tooltip>
                      </>
                    }
                    type="error"
                    showIcon
                    style={{ marginTop: '16px' }}
                  />
                )
              ) : null}
              <ProCard
                type="inner"
                className={`${styles.componentCard}`}
                key={oceanBaseInfo.group}
              >
                <Table
                  className={styles.componentTable}
                  columns={getColumns(oceanBaseInfo.group, false)}
                  rowKey="key"
                  dataSource={oceanBaseInfo.content}
                  pagination={false}
                  rowClassName={(record) => {
                    if (record.key === ocpexpressComponent && lowVersion) {
                      return styles.disabledRow;
                    }
                  }}
                />
              </ProCard>
            </Space>
          </ProCard>
          <ProCard
            title={
              <>
                {intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.OptionalComponents',
                  defaultMessage: '可选组件',
                })}

                <span className={styles.titleExtra}>
                  <InfoCircleOutlined />{' '}
                  {intl.formatMessage(
                    {
                      id: 'OBD.pages.components.InstallConfig.EstimatedInstallationRequiresSizeMb',
                      defaultMessage: '预计部署需要 {size}MB 空间',
                    },
                    { size: caculateSize(componentsMemory) },
                  )}
                </span>
              </>
            }
            className="card-header-padding-top-0 card-padding-bottom-24  card-padding-top-0"
          >
            {componentsGroupInfo.map((componentInfo) => (
              <Space
                className={styles.spaceWidth}
                direction="vertical"
                size="middle"
              >
                <ProCard
                  type="inner"
                  className={`${styles.componentCard}`}
                  key={componentInfo.group}
                >
                  <Table
                    rowSelection={{
                      hideSelectAll: true,
                      selectedRowKeys: selectedConfig,
                      onSelect: handleSelect,
                    }}
                    className={styles.componentTable}
                    columns={getColumns(componentInfo.group, true)}
                    rowKey="key"
                    dataSource={componentInfo.content}
                    pagination={false}
                    rowClassName={(record) => {
                      if (record.key === ocpexpressComponent && lowVersion) {
                        return styles.disabledRow;
                      }
                    }}
                  />
                </ProCard>
              </Space>
            ))}
          </ProCard>
        </ProCard>
        <footer className={styles.pageFooterContainer}>
          <div className={styles.pageFooter}>
            <Space className={styles.foolterAction}>
              <Button
                onClick={() => handleQuit(handleQuitProgress, setCurrentStep)}
                data-aspm-click="c307507.d317381"
                data-aspm-desc={intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.DeploymentConfigurationExit',
                  defaultMessage: '部署配置-退出',
                })}
                data-aspm-param={``}
                data-aspm-expo
              >
                {intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.Exit',
                  defaultMessage: '退出',
                })}
              </Button>
              <Button onClick={preStep}>
                {intl.formatMessage({
                  id: 'OBD.pages.Obdeploy.InstallConfig.PreviousStep',
                  defaultMessage: '上一步',
                })}
              </Button>
              <Button
                type="primary"
                onClick={nextStep}
                disabled={
                  lowVersion ||
                  existNoVersion ||
                  versionLoading ||
                  componentLoading
                }
                data-aspm-click="c307507.d317280"
                data-aspm-desc={intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.DeploymentConfigurationNextStep',
                  defaultMessage: '部署配置-下一步',
                })}
                data-aspm-param={``}
                data-aspm-expo
              >
                {intl.formatMessage({
                  id: 'OBD.pages.components.InstallConfig.NextStep',
                  defaultMessage: '下一步',
                })}
              </Button>
            </Space>
          </div>
        </footer>
        {deleteLoadingVisible && (
          <DeleteDeployModal
            visible={deleteLoadingVisible}
            name={deleteName}
            onCancel={() => setDeleteLoadingVisible(false)}
            setOBVersionValue={setOBVersionValue}
          />
        )}
      </Space>
    </Spin>
  );
}
