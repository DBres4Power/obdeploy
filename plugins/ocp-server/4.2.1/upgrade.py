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


def upgrade(plugin_context, search_py_script_plugin, apply_param_plugin, *args, **kwargs):
    namespace = plugin_context.namespace
    namespaces = plugin_context.namespaces
    deploy_name = plugin_context.deploy_name
    repositories = plugin_context.repositories
    plugin_name = plugin_context.plugin_name

    components = plugin_context.components
    clients = plugin_context.clients
    cluster_config = plugin_context.cluster_config
    cmds = plugin_context.cmds
    options = plugin_context.options
    dev_mode = plugin_context.dev_mode
    stdio = plugin_context.stdio
    upgrade_repositories = kwargs.get('upgrade_repositories')
    sys_cursor = kwargs.get('sys_cursor')
    metadb_cursor = kwargs.get('metadb_cursor')

    cur_repository = upgrade_repositories[0]
    dest_repository = upgrade_repositories[-1]
    repository_dir = dest_repository.repository_dir
    kwargs['repository_dir'] = repository_dir

    stop_plugin = search_py_script_plugin([cur_repository], 'stop')[cur_repository]
    init_plugin = search_py_script_plugin([dest_repository], 'init')[dest_repository]
    start_plugin = search_py_script_plugin([dest_repository], 'start')[dest_repository]
    connect_plugin = search_py_script_plugin([dest_repository], 'connect')[dest_repository]
    display_plugin = search_py_script_plugin([dest_repository], 'display')[dest_repository]

    apply_param_plugin(cur_repository)
    if not stop_plugin(namespace, namespaces, deploy_name, repositories, components, clients, cluster_config, cmds, options, stdio, *args, **kwargs):
        return plugin_context.return_false()

    try:
        servers = cluster_config.servers
        for server in servers:
            client = clients[server]
            res = client.execute_command("sudo docker ps | grep ocp-all-in-one | awk '{print 1}'").stdout.strip()
            client.execute_command('sudo docker stop %s' % res)
    except:
        pass

    apply_param_plugin(dest_repository)
    if not init_plugin(namespace, namespaces, deploy_name, repositories, components, clients, cluster_config, cmds, options, stdio, upgrade=True, *args, **kwargs):
        return plugin_context.return_false()

    if not start_plugin(namespace, namespaces, deploy_name, repositories, components, clients, cluster_config, cmds, options, stdio, sys_cursor1=sys_cursor, cursor=metadb_cursor, without_ocp_parameter=True, *args, **kwargs):
        return plugin_context.return_false()

    ret = connect_plugin(namespace, namespaces, deploy_name, repositories, components, clients, cluster_config, cmds, options, stdio, *args, **kwargs)
    if ret:
        cursor = ret.get_return('cursor')
        if display_plugin(namespace, namespaces, deploy_name, repositories, components, clients, cluster_config, cmds, options, stdio, cursor=cursor, *args, **kwargs):
            return plugin_context.return_true()
    return plugin_context.return_false()
