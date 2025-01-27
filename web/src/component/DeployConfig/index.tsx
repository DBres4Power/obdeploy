import { commonStyle, STABLE_OCP_VERSION } from '@/pages/constants';
import { queryAllComponentVersions } from '@/services/ob-deploy-web/Components';
import {
  getClusterNames,
  getConnectInfo,
} from '@/services/ocp_installer_backend/OCP';
import {
  clusterNameReg,
  errorHandler,
  getErrorInfo,
  updateClusterNameReg,
} from '@/utils';
import copy from 'copy-to-clipboard';
import { getTailPath } from '@/utils/helper';
import { intl } from '@/utils/intl';
import customRequest from '@/utils/useRequest';
import { InfoCircleOutlined, CopyOutlined } from '@ant-design/icons';
import { ProCard, ProForm, ProFormText } from '@ant-design/pro-components';
import { useRequest, useUpdateEffect } from 'ahooks';
import {
  Button,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Alert,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FormInstance } from 'antd/lib/form';
import NP from 'number-precision';
import { useEffect, useRef, useState } from 'react';
import { getLocale, history, useModel } from 'umi';
import EnStyles from '../../pages/Obdeploy/indexEn.less';
import ZhStyles from '../../pages/Obdeploy/indexZh.less';
import CustomFooter from '../CustomFooter';
import ErrorCompToolTip from '../ErrorCompToolTip';
import { listRemoteMirrors } from '@/services/ob-deploy-web/Mirror';
import ExitBtn from '../ExitBtn';
import type {
  ClusterNameType,
  TableDataType,
  VersionInfoType,
} from './constants';
import {
  CompoentsInfo,
  OBComponent,
  OBPROXY,
  OBProxyComponent,
  OCEANBASE,
  OCP,
  OCPComponent,
} from './constants';

const locale = getLocale();
const styles = locale === 'zh-CN' ? ZhStyles : EnStyles;

export default function DeployConfig({
  setCurrent,
  current,
  connectForm,
  clearConnection,
}: API.StepProp & {
  connectForm?: FormInstance<any>;
  clearConnection?: () => void;
}) {
  const {
    getInfoByName,
    setErrorVisible,
    errorsList,
    setErrorsList,
    setOcpNewFirstTime,
    ocpConfigData,
    setOcpConfigData,
    selectCluster,
    setSelectCluster,
  } = useModel('global');
  const {
    obVersionInfo,
    setObVersionInfo,
    ocpVersionInfo,
    setOcpVersionInfo,
    obproxyVersionInfo,
    setObproxyVersionInfo,
    deployMemory,
    setDeployMemory,
    tableData,
    setTableData,
  } = useModel('ocpInstallData');
  const [componentLoading, setComponentLoading] = useState(false);
  const taiPath = getTailPath();
  const isUpdate = taiPath === 'update';
  const isNewDB = taiPath === 'install';
  const [form] = ProForm.useForm();
  const checkRegInfo = {
    reg: isUpdate ? updateClusterNameReg : clusterNameReg,
    msg: isUpdate
      ? intl.formatMessage({
          id: 'OBD.component.DeployConfig.ItStartsWithALetter.1',
          defaultMessage:
            '以英文字母开头、英文或数字结尾，可包含英文、数字、连字符和下划线，且长度为 2 ~ 32',
        })
      : intl.formatMessage({
          id: 'OBD.component.DeployConfig.ItStartsWithALetter',
          defaultMessage:
            '以英文字母开头、英文或数字结尾，可包含英文、数字和下划线，且长度为 2 ~ 32',
        }),
  };
  const { components = {} } = ocpConfigData || {};
  const { oceanbase = {} } = components || {};
  const [clusterOption, setClusterOption] = useState<ClusterNameType[]>([]);
  const selectClusetNameRef = useRef();
  const searchTextRef = useRef<string>();
  const [existNoVersion, setExistNoVersion] = useState(false);
  const wholeComponents = useRef<TableDataType[]>([]);
  const [unavailableList, setUnavailableList] = useState<string[]>([]);
  //查询version的前两位和type相匹配的obproxyInfo
  const findObproxy = (version: string, type: 'ce' | 'business') => {
    const obproxyVersionInfo = tableData?.find(
      (item: TableDataType) => item.key === OBPROXY,
    )?.versionInfo;
    const target = obproxyVersionInfo?.find(
      (item: VersionInfoType) =>
        // 类型以及版本号前两位相同
        item.versionType === type &&
        version[0] === item.version[0] &&
        version[2] === item.version[2],
    );
    return target;
  };

  const onVersionChange = (versionInfo: any, record: any) => {
    const _version = versionInfo.value;
    const [version, release, md5] = _version.split('-');
    const versionType = record.versionInfo.find(
      (item: VersionInfoType) =>
        item.version === version &&
        item.md5 === md5 &&
        item.release === release,
    ).versionType;
    let target;
    if (record.key === OCEANBASE) {
      if (obVersionInfo?.versionType !== versionType) {
        target = findObproxy(_version, versionType);
      } else if (
        obVersionInfo?.version[0] !== _version[0] ||
        obVersionInfo?.version[2] !== _version[2]
      ) {
        target = findObproxy(_version, versionType);
      }
      if (target) {
        target.value = `${target.version}-${target.release}`;
        setObproxyVersionInfo(target);
      }
      setObVersionInfo({
        version,
        release,
        md5,
        versionType,
        value: _version,
      });
    }
    if (record.key === OCP) {
      setOcpVersionInfo({
        version,
        release,
        md5,
        versionType,
        value: _version,
      });
    }
  };
  const getColumns = () => {
    const columns: ColumnsType<TableDataType> = [
      {
        title: intl.formatMessage({
          id: 'OBD.component.DeployConfig.ProductName',
          defaultMessage: '产品名称',
        }),
        dataIndex: 'name',
        width: locale === 'zh-CN' ? 134 : 140,
        render: (name, record) => {
          return (
            <>
              {name}
              {!record.versionInfo.length && (
                <ErrorCompToolTip
                  title={intl.formatMessage({
                    id: 'OBD.component.DeployConfig.UnableToObtainTheInstallation',
                    defaultMessage: '无法获取安装包，请检查安装程序配置。',
                  })}
                  status="error"
                />
              )}
            </>
          );
        },
      },
      {
        title: intl.formatMessage({
          id: 'OBD.component.DeployConfig.Version',
          defaultMessage: '版本',
        }),
        dataIndex: 'versionInfo',
        width: 220,
        render: (_, record) => {
          let selectVersion =
            record.key === OCEANBASE
              ? obVersionInfo
              : record.key === OBPROXY
              ? obproxyVersionInfo
              : ocpVersionInfo;

          if (selectVersion) {
            selectVersion.valueInfo = {
              value: selectVersion?.value,
              label: (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      textOverflow: 'ellipsis',
                      width: '122px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    V {selectVersion?.version}
                    {selectVersion?.release ? `-${selectVersion?.release}` : ''}
                  </div>
                  {selectVersion?.versionType === 'ce' ? (
                    <Tag className="default-tag ml-8">
                      {intl.formatMessage({
                        id: 'OBD.component.DeployConfig.CommunityEdition',
                        defaultMessage: '社区版',
                      })}
                    </Tag>
                  ) : (
                    <Tag className="blue-tag ml-8">
                      {intl.formatMessage({
                        id: 'OBD.component.DeployConfig.CommercialEdition',
                        defaultMessage: '商业版',
                      })}
                    </Tag>
                  )}
                </div>
              ),
            };
          } else {
            selectVersion = {};
          }
          return (
            // 版本联动 ocp是社区版，ob也得是社区版，obproxy不支持选择并且版本号与ob前两位一致
            <Tooltip title={selectVersion?.value}>
              {record.key === OBPROXY ? (
                // 用div包裹可以使Tooltip生效
                <div>
                  <Select
                    suffixIcon={null}
                    labelInValue
                    value={selectVersion?.valueInfo}
                    style={{ pointerEvents: 'none', width: 207 }}
                  />
                </div>
              ) : (
                <Select
                  // optionLabelProp="data_value"
                  value={selectVersion?.valueInfo}
                  labelInValue
                  onChange={(value) => onVersionChange(value, record)}
                  style={{ width: 207 }}
                >
                  {_.map((item: any) => (
                    <Select.Option
                      value={`${item.version}-${item?.release}-${item.md5}`}
                      // data_value={item.version}
                      key={`${item.version}-${item?.release}-${item.md5}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div
                          style={{
                            textOverflow: 'ellipsis',
                            width: '122px',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          V {item.version}
                          {item?.release ? `-${item?.release}` : ''}
                        </div>
                        {item.versionType === 'ce' ? (
                          <Tag className="default-tag ml-8">
                            {intl.formatMessage({
                              id: 'OBD.component.DeployConfig.CommunityEdition',
                              defaultMessage: '社区版',
                            })}
                          </Tag>
                        ) : (
                          <Tag className="blue-tag ml-8">
                            {intl.formatMessage({
                              id: 'OBD.component.DeployConfig.CommercialEdition',
                              defaultMessage: '商业版',
                            })}
                          </Tag>
                        )}
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              )}
            </Tooltip>
          );
        },
      },
      {
        title: intl.formatMessage({
          id: 'OBD.component.DeployConfig.Description',
          defaultMessage: '描述',
        }),
        dataIndex: 'componentInfo',
        render: (_, record) => (
          <>
            {record.componentInfo.desc || '-'}
            <a
              className={styles.learnMore}
              href={record.componentInfo.url}
              target="_blank"
            >
              {intl.formatMessage({
                id: 'OBD.component.DeployConfig.LearnMore',
                defaultMessage: '了解更多',
              })}
            </a>
          </>
        ),
      },
    ];

    return columns;
  };
  const nameValidator = async (_: any, value: string) => {
    if (value) {
      if (!checkRegInfo.reg.test(value)) {
        return Promise.reject(new Error(checkRegInfo.msg));
      }
      if (!isUpdate) {
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
                    id: 'OBD.component.DeployConfig.ADeploymentNameWithValue',
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
            if (isUpdate) {
              return Promise.reject(
                new Error(
                  intl.formatMessage(
                    {
                      id: 'OBD.component.DeployConfig.TheDeploymentNameWithValue',
                      defaultMessage: '不存在为 {value} 的部署名称',
                    },
                    { value: value },
                  ),
                ),
              );
            }
            return Promise.resolve();
          } else {
            const errorInfo = getErrorInfo({ response, data, type });
            setErrorVisible(true);
            setErrorsList([...errorsList, errorInfo]);
          }
        }
      }
    }
  };

  const caculateSize = (originSize: number): number => {
    return Number(NP.divide(NP.divide(originSize, 1024), 1024).toFixed(2));
  };
  const getVersion = (name: string, info?: any[]) => {
    if (!info) return [];
    return info.map((item) => ({
      versionType: item.version_type,
      version: item.version,
      release: item.release,
      md5: item.md5,
    }));
  };

  const getRecommendInfo = (data: any) => {
    if (data.key === OCP) {
      let stableVersionArr = data.info.filter((item: any) => {
        const versionArr = item.version.split('.');
        return (
          versionArr[0] === STABLE_OCP_VERSION[0] &&
          versionArr[1] === STABLE_OCP_VERSION[1] &&
          versionArr[2] === STABLE_OCP_VERSION[2]
        );
      });
      const temp = stableVersionArr.map((item: any) =>
        Number(item?.release?.split('.')[0]),
      );
      if (temp && temp.length >= 2) {
        const maxRelease = temp.sort(
          (pre: number, next: number) => next - pre,
        )[0];
        return stableVersionArr.find(
          (stableVersion: any) =>
            Number(stableVersion?.release?.split('.')[0]) === maxRelease,
        );
      } else {
        return data.info[0];
      }
    }
    return data.info[0];
  };

  const judgVersions = (length: number) => {
    if (length !== wholeComponents.current.length) {
      setExistNoVersion(true);
    } else {
      setExistNoVersion(false);
    }
  };

  //初始值 最新版本
  const setInitVersion = (data: any) => {
    let versionInfo = getRecommendInfo(data);
    let detail = {
      version: versionInfo.version,
      release: versionInfo.release,
      md5: versionInfo.md5,
      versionType: versionInfo.version_type || 'business',
      value: `${versionInfo.version}-${versionInfo.release}`,
    };
    if (data.name === OCEANBASE) {
      setObVersionInfo(detail);
    }
    if (data.name === OCP) {
      setOcpVersionInfo(detail);
    }
    if (data.name === OBPROXY) {
      setObproxyVersionInfo(detail);
    }
  };

  const { run: getClusterList } = useRequest(getClusterNames, {
    manual: true,
    onSuccess: (res) => {
      if (res.success) {
        let clusterNames = res.data?.name.map((val: string) => ({
          label: val,
          value: val,
        }));
        setClusterOption(clusterNames || []);
      }
    },
  });

  //获取连接信息默认值
  const { run: getConnectInfoReq } = useRequest(getConnectInfo, {
    manual: true,
    onError: ({ response, data }: any) => {
      errorHandler({ response, data });
    },
  });

  const prevStep = () => {
    setOcpConfigData({});
    setErrorVisible(false);
    setErrorsList([]);
    setObVersionInfo(undefined);
    setOcpVersionInfo(undefined);
    setObproxyVersionInfo(undefined);
    setTableData(undefined);
    if (isUpdate) {
      history.push('/updateWelcome');
    } else {
      history.push('/ocpInstaller');
    }
  };

  const formateConnectData = (data: API.ConnectInfo) => {
    return {
      host: data.host,
      port: data.port,
      database: data.database,
      accessUser: data.user || 'ocp@ocp_meta',
      accessCode: data.password,
    };
  };

  const changeClusterName = (newName: string): boolean => {
    let oldName = ocpConfigData?.components?.oceanbase?.appname;
    return oldName !== newName;
  };

  const nextStep = () => {
    if (form.getFieldsError(['appname'])[0].errors.length) return;
    form.validateFields().then(async (values) => {
      let newComponents: API.Components, newOcpConfigData: any;
      if (!isNewDB) {
        newComponents = {
          oceanbase: {
            appname: values?.appname,
          },
          ocpserver: {
            ...(components?.ocpserver || {}),
            component:
              ocpVersionInfo?.versionType === 'ce'
                ? 'ocp-server-ce'
                : 'ocp-server',
            version: ocpVersionInfo?.version,
            release: ocpVersionInfo?.release,
            package_hash: ocpVersionInfo?.md5,
          },
        };
      } else {
        newComponents = {
          oceanbase: {
            ...(components?.oceanbase || {}),
            component:
              obVersionInfo?.versionType === 'ce' ? 'oceanbase-ce' : OCEANBASE,
            appname: values?.appname,
            version: obVersionInfo?.version,
            release: obVersionInfo?.release,
            package_hash: obVersionInfo?.md5,
          },
          obproxy: {
            ...(components?.obproxy || {}),
            component:
              obproxyVersionInfo?.versionType === 'ce' ? 'obproxy-ce' : OBPROXY,
            version: obproxyVersionInfo?.version,
            release: obproxyVersionInfo?.release,
            package_hash: obproxyVersionInfo?.md5,
          },
          ocpserver: {
            ...(components?.ocpserver || {}),
            component:
              ocpVersionInfo?.versionType === 'ce'
                ? 'ocp-server-ce'
                : 'ocp-server',
            version: ocpVersionInfo?.version,
            release: ocpVersionInfo?.release,
            package_hash: ocpVersionInfo?.md5,
          },
        };
      }
      newOcpConfigData = {
        ...ocpConfigData,
        components: newComponents,
      };
      if (isUpdate && changeClusterName(values?.appname)) {
        try {
          const { success, data } = await getConnectInfoReq({
            name: values?.appname,
          });
          if (success && data) {
            //首次进入 设置初始值
            if (!ocpConfigData.updateConnectInfo) {
              newOcpConfigData.updateConnectInfo =
                formateConnectData(data) || {};
            } else {
              //重置状态
              clearConnection && clearConnection();
              connectForm?.setFieldsValue({
                ...formateConnectData(data),
              });
            }
          }
        } catch (err) {}
      }

      setOcpConfigData({ ...newOcpConfigData });
      setCurrent(current + 1);
      setOcpNewFirstTime(false);
      setErrorVisible(false);
      setErrorsList([]);
    });
  };

  const oparete = (item: any, dataSource: any, memory: number) => {
    const component = CompoentsInfo.find(
      (compoentInfo) => compoentInfo.key === item.name,
    );
    let temp: TableDataType = {
      name: component?.name!,
      versionInfo: getVersion(item.name, item.info),
      componentInfo: component!,
      key: component?.key!,
    };
    setInitVersion(item);
    memory += caculateSize(getRecommendInfo(item).estimated_size);
    dataSource.push(temp);
    return memory;
  };

  const sortComponent = (dataSource: any[]) => {
    let OCPComp = dataSource.find((comp) => comp.key === OCP);
    let OBComp = dataSource.find((comp) => comp.key === OCEANBASE);
    let ProxyComp = dataSource.find((comp) => comp.key === OBPROXY);
    dataSource[0] = OCPComp;
    dataSource[1] = OBComp;
    dataSource[2] = ProxyComp;
  };

  const completionComponent = (dataSource: any[]) => {
    for (let component of wholeComponents.current) {
      if (!dataSource.find((item) => item.name === component.name)) {
        dataSource.push(component);
      }
    }
  };

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

  const { run: fetchAllComponentVersions, loading: versionLoading } =
    customRequest(queryAllComponentVersions, {
      onSuccess: async ({
        success,
        data,
      }: API.OBResponseDataListComponent_) => {
        if (success && data?.items) {
          let dataSource: any[] = [],
            memory = 0;
          for (let item of data?.items) {
            if (!isNewDB) {
              wholeComponents.current = [OCPComponent];
              if (item.name === OCP) {
                if (item.info?.length) {
                  memory = oparete(item, dataSource, memory);
                }
              }
            } else {
              wholeComponents.current = [
                OCPComponent,
                OBComponent,
                OBProxyComponent,
              ];

              if (
                item.name === OCP ||
                item.name === OCEANBASE ||
                item.name === OBPROXY
              ) {
                if (item.info?.length) {
                  memory = oparete(item, dataSource, memory);
                }
              }
            }
          }

          //需判断是否区分部署有无metadb 升级wholeComponents
          const noVersion =
            dataSource.length !== wholeComponents.current.length;
          judgVersions(dataSource.length);

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

          completionComponent(dataSource);
          isNewDB && sortComponent(dataSource);
          setDeployMemory(memory);
          setTableData(dataSource);
          setComponentLoading(false);
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

  useEffect(() => {
    getClusterList();
    if (!obVersionInfo || !obproxyVersionInfo || !ocpVersionInfo) {
      setComponentLoading(true);
      fetchAllComponentVersions();
    }
  }, []);
  const handleChangeCluster = (val: string) => {
    setSelectCluster(val);
    form.setFieldValue('appname', val);
  };

  const handleSearchCluster = (val: string) => {
    if (val) {
      searchTextRef.current = val;
    }
  };

  const handleChangeSearchText = () => {
    const select = clusterOption.find((option) => {
      return option.value === searchTextRef.current;
    });
    if (!select && searchTextRef.current) {
      setClusterOption([
        { value: searchTextRef.current, label: searchTextRef.current },
        ...clusterOption,
      ]);
    }
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

  const clusterNameRules = [
    {
      required: true,
      message: intl.formatMessage({
        id: 'OBD.component.DeployConfig.EnterAClusterName',
        defaultMessage: '请输入集群名称',
      }),
      validateTrigger: 'onChange',
    },
    {
      pattern: checkRegInfo.reg,
      message: checkRegInfo.msg,

      validateTrigger: 'onChange',
    },
    { validator: nameValidator, validateTrigger: 'onBlur' },
  ];

  const cluserNameProps = {
    name: 'appname',
    label: intl.formatMessage({
      id: 'OBD.component.DeployConfig.ClusterName',
      defaultMessage: '集群名称',
    }),
    rules: clusterNameRules,
    placeholder: intl.formatMessage({
      id: 'OBD.component.DeployConfig.PleaseEnter',
      defaultMessage: '请输入',
    }),
    validateTrigger: ['onBlur', 'onChange'],
  };

  useEffect(() => {
    if (searchTextRef.current) {
      setSelectCluster(searchTextRef.current);
      form.setFieldValue('appname', searchTextRef.current);
    }
  }, [clusterOption]);

  useUpdateEffect(() => {
    form.validateFields(['appname']);
  }, [selectCluster]);

  return (
    <>
      <Spin spinning={componentLoading}>
        <Space className={styles.spaceWidth} direction="vertical" size="middle">
          <ProCard className={styles.pageCard} split="horizontal">
            <ProCard
              title={
                isNewDB
                  ? intl.formatMessage({
                      id: 'OBD.component.DeployConfig.BasicConfiguration',
                      defaultMessage: '基础配置',
                    })
                  : intl.formatMessage({
                      id: 'OBD.component.DeployConfig.DeploymentConfiguration',
                      defaultMessage: '部署配置',
                    })
              }
              className="card-padding-bottom-24"
            >
              <ProForm
                form={form}
                initialValues={{ appname: oceanbase?.appname || '' }}
                submitter={false}
              >
                {isUpdate ? (
                  <>
                    <ProForm.Item {...cluserNameProps} validateFirst>
                      <Select
                        ref={selectClusetNameRef}
                        style={commonStyle}
                        options={clusterOption}
                        value={selectCluster}
                        onInputKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            selectClusetNameRef.current.blur();
                          }
                        }}
                        onChange={handleChangeCluster}
                        onBlur={handleChangeSearchText}
                        showSearch
                        onSearch={handleSearchCluster}
                      />
                    </ProForm.Item>
                  </>
                ) : (
                  <ProFormText
                    {...cluserNameProps}
                    validateTrigger={['onBlur', 'onChange']}
                    fieldProps={{ style: commonStyle }}
                  />
                )}
              </ProForm>
            </ProCard>
            <ProCard
              title={
                <>
                  {intl.formatMessage({
                    id: 'OBD.component.DeployConfig.VersionSelection',
                    defaultMessage: '版本选择',
                  })}

                  <span className={styles.titleExtra}>
                    <InfoCircleOutlined style={{ marginRight: 4 }} />
                    {intl.formatMessage({
                      id: 'OBD.component.DeployConfig.EstimatedInstallationRequirements',
                      defaultMessage: '预计安装需要',
                    })}
                    {deployMemory}
                    {intl.formatMessage({
                      id: 'OBD.component.DeployConfig.MbSpace',
                      defaultMessage: 'MB空间',
                    })}
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
                            id: 'OBD.component.DeployConfig.IfTheCurrentEnvironmentCannot',
                            defaultMessage:
                              '如当前环境无法正常访问外网，建议使用 OceanBase\n                          离线安装包进行安装部署。',
                          })}

                          <a
                            href="https://open.oceanbase.com/softwareCenter/community"
                            target="_blank"
                          >
                            {intl.formatMessage({
                              id: 'OBD.component.DeployConfig.GoToDownloadOfflineInstallation',
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
                                id: 'OBD.component.DeployConfig.HowToEnableOnlineImage',
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
                  style={{ border: '1px solid #e2e8f3' }}
                  //   key={oceanBaseInfo.group}
                >
                  <Table
                    className={styles.componentTable}
                    columns={getColumns()}
                    pagination={false}
                    dataSource={tableData}
                    rowKey="name"
                  />
                </ProCard>
              </Space>
            </ProCard>
          </ProCard>
        </Space>
      </Spin>
      <CustomFooter>
        <ExitBtn />
        <Button
          data-aspm-click="ca54435.da43437"
          data-aspm-desc={intl.formatMessage({
            id: 'OBD.component.DeployConfig.DeploymentConfigurationPreviousStep',
            defaultMessage: '部署配置-上一步',
          })}
          data-aspm-param={``}
          data-aspm-expo
          onClick={prevStep}
        >
          {intl.formatMessage({
            id: 'OBD.component.DeployConfig.PreviousStep',
            defaultMessage: '上一步',
          })}
        </Button>
        <Button
          data-aspm-click="ca54435.da43438"
          data-aspm-desc={intl.formatMessage({
            id: 'OBD.component.DeployConfig.DeploymentConfigurationNextStep',
            defaultMessage: '部署配置-下一步',
          })}
          data-aspm-param={``}
          data-aspm-expo
          type="primary"
          disabled={existNoVersion || versionLoading || componentLoading}
          onClick={nextStep}
        >
          {intl.formatMessage({
            id: 'OBD.component.DeployConfig.NextStep',
            defaultMessage: '下一步',
          })}
        </Button>
      </CustomFooter>
    </>
  );
}
