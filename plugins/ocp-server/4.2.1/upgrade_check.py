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

import re
import time

import _errno as err
from _rpm import Version


def upgrade_check(plugin_context, meta_cursor, database='meta_database', init_check_status=False, *args, **kwargs):
    def check_pass(item):
        status = check_status[server]
        if status[item].status == err.CheckStatus.WAIT:
            status[item].status = err.CheckStatus.PASS
    def check_fail(item, error, suggests=[]):
        status = check_status[server][item]
        status.error = error
        status.suggests = suggests
        status.status = err.CheckStatus.FAIL
    def wait_2_pass():
        status = check_status[server]
        for item in status:
            check_pass(item)
    def alert(item, error, suggests=[]):
        global success
        stdio.warn(error)
    def error(item, _error, suggests=[]):
        global success
        success = False
        check_fail(item, _error, suggests)
        stdio.error(_error)
    def critical(item, error, suggests=[]):
        global success
        success = False
        check_fail(item, error, suggests)
        stdio.error(error)


    check_status = {}
    repositories = plugin_context.repositories
    options = plugin_context.options
    stdio = plugin_context.stdio
    clients = plugin_context.clients
    cluster_config = plugin_context.cluster_config
    plugin_context.set_variable('start_check_status', check_status)

    for server in cluster_config.servers:
        check_status[server] = {
            'check_operation_task': err.CheckStatus(),
            'check_machine_status': err.CheckStatus(),
            'metadb_version': err.CheckStatus(),
            'java': err.CheckStatus(),
        }

    if init_check_status:
        return plugin_context.return_true(start_check_status=check_status)

    stdio.start_loading('Check before upgrade ocp-server')
    success = True

    for server in cluster_config.servers:
        client = clients[server]
        server_config = cluster_config.get_server_conf_with_default(server)
        try:
            # java version check
            java_bin = server_config.get('java_bin', '/usr/bin/java')
            ret = client.execute_command('{} -version'.format(java_bin))
            if not ret:
                critical('java', err.EC_OCP_EXPRESS_JAVA_NOT_FOUND.format(server=str(server)), [err.SUG_OCP_EXPRESS_INSTALL_JAVA_WITH_VERSION.format(version='1.8.0')])
            version_pattern = r'version\s+\"(\d+\.\d+\.\d+)(\_\d+)'
            found = re.search(version_pattern, ret.stdout) or re.search(version_pattern, ret.stderr)
            if not found:
                error('java', err.EC_OCP_EXPRESS_JAVA_VERSION_ERROR.format(server=str(server), version='1.8.0'), [err.SUG_OCP_EXPRESS_INSTALL_JAVA_WITH_VERSION.format(version='1.8.0'),])
            java_major_version = found.group(1)
            java_update_version = found.group(2)[1:]
            if Version(java_major_version) != Version('1.8.0') and int(java_update_version) >= 161:
                critical('java', err.EC_OCP_SERVER_JAVA_VERSION_ERROR.format(server=str(server), version='1.8.0'), [err.SUG_OCP_EXPRESS_INSTALL_JAVA_WITH_VERSION.format(version='1.8.0'),])
            check_pass('java')
        except Exception as e:
            stdio.error(e)
            error('java', err.EC_OCP_EXPRESS_JAVA_VERSION_ERROR.format(server=str(server), version='1.8.0'),
                  [err.SUG_OCP_EXPRESS_INSTALL_JAVA_WITH_VERSION.format(version='1.8.0'), ])

        sql = "select count(*) num from %s.task_instance where state not in ('FAILED', 'SUCCESSFUL');" % database
        if meta_cursor.fetchone(sql)['num'] > 0:
            success = False
            error('check_operation_task', err.EC_OCP_SERVER_RUNNING_TASK)
        else:
            check_pass('check_operation_task')

        sql = "select count(*) num from %s.compute_host where status not in ('available', 'online');" % database
        if meta_cursor.fetchone(sql)['num'] > 0:
            success = False
            error('check_machine_status', err.EC_OCP_SERVER_MACHINE_STATUS)
        else:
            check_pass('check_machine_status')

        sql = "select ob_version();"
        v1 = meta_cursor.fetchone(sql)['ob_version()']
        if Version(v1) > Version('2.2.50'):
            check_pass('metadb_version')
        else:
            success = False
            error('metadb_version', err.EC_OCP_SERVER_METADB_VERSION)

    if success:
        stdio.stop_loading('succeed')
        return plugin_context.return_true()
    else:
        stdio.stop_loading('fail')
        return plugin_context.return_false()



