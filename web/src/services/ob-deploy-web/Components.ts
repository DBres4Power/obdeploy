// @ts-ignore
/* eslint-disable */
import { request } from 'umi';

/** List Components query all component versions GET /api/v1/components */
export async function queryAllComponentVersions(options?: {
  [key: string]: any;
}) {
  return request<API.OBResponseDataListComponent_>('/api/v1/components', {
    method: 'GET',
    ...(options || {}),
  });
}

/** Get Component query component by component name GET /api/v1/components/${param0} */
export async function queryComponentByComponentName(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.queryComponentByComponentNameParams,
  options?: { [key: string]: any },
) {
  const { component: param0, ...queryParams } = params;
  return request<API.OBResponseComponent_>(`/api/v1/components/${param0}`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** List Component Parameters query component parameters POST /api/v1/components/parameters */
export async function queryComponentParameters(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.queryComponentParametersParams & {
    // header
    'accept-language'?: string;
  },
  body: API.ParameterRequest,
  options?: { [key: string]: any },
) {
  return request<API.OBResponseDataListParameterMeta_>(
    '/api/v1/components/parameters',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...params },
      data: body,
      ...(options || {}),
    },
  );
}
