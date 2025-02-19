# coding: utf-8
# OceanBase Deploy.
# Copyright (C) 2021 OceanBase
#
# This file is part of OceanBase Deploy.
#
# OceanBase Deploy is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# OceanBase Deploy is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with OceanBase Deploy.  If not, see <https://www.gnu.org/licenses/>.


from __future__ import absolute_import, division, print_function

import hashlib

from tool import ConfigUtil


def generate_config(plugin_context, generate_config_mini=False, auto_depend=False, return_generate_keys=False, only_generate_password=False, generate_password=True, *args, **kwargs):
    if return_generate_keys:
        generate_keys = []
        if generate_password:
            generate_keys += ['obproxy_sys_password']
        if not only_generate_password:
            generate_keys += ['skip_proxy_sys_private_check', 'enable_strict_kernel_release', 'enable_cluster_checkout', 'proxy_mem_limited']
        return plugin_context.return_true(generate_keys=generate_keys)

    cluster_config = plugin_context.cluster_config
    if generate_password:
        generate_random_password(cluster_config)
    if only_generate_password:
        return plugin_context.return_true()

    stdio = plugin_context.stdio
    generate_configs = {'global': {}}
    plugin_context.set_variable('generate_configs', generate_configs)
    stdio.start_loading('Generate obproxy configuration')

    global_config = cluster_config.get_original_global_conf()
    if 'skip_proxy_sys_private_check' not in global_config:
        generate_configs['global']['skip_proxy_sys_private_check'] = True
        cluster_config.update_global_conf('skip_proxy_sys_private_check', True, False)

    if 'enable_strict_kernel_release' not in global_config:
        generate_configs['global']['enable_strict_kernel_release'] = False
        cluster_config.update_global_conf('enable_strict_kernel_release', False, False)

    if 'enable_cluster_checkout' not in global_config:
        generate_configs['global']['enable_cluster_checkout'] = False
        cluster_config.update_global_conf('enable_cluster_checkout', False, False)

    if generate_config_mini:
        if 'proxy_mem_limited' not in global_config:
            generate_configs['global']['proxy_mem_limited'] = '500M'
            cluster_config.update_global_conf('proxy_mem_limited', '500M', False)

    if auto_depend:
        for depend in ['oceanbase', 'oceanbase-ce']:
            if cluster_config.add_depend_component(depend):
                stdio.stop_loading('succeed')
                return plugin_context.return_true()

    stdio.stop_loading('succeed')
    return plugin_context.return_true()


def generate_random_password(cluster_config):
    global_config = cluster_config.get_original_global_conf()
    if 'obproxy_sys_password' not in global_config:
        cluster_config.update_global_conf('obproxy_sys_password', ConfigUtil.get_random_pwd_by_total_length())