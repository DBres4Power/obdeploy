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

import os
import _errno as err


stdio = None
success = True


def get_port_socket_inode(client, port):
    port = hex(port)[2:].zfill(4).upper()
    cmd = "bash -c 'cat /proc/net/{tcp*,udp*}' | awk -F' ' '{print $2,$10}' | grep '00000000:%s' | awk -F' ' '{print $2}' | uniq" % port
    res = client.execute_command(cmd)
    if not res or not res.stdout.strip():
        return False
    stdio.verbose(res.stdout)
    return res.stdout.strip().split('\n')


def start_check(plugin_context, init_check_status=False, strict_check=False, work_dir_check=False, work_dir_empty_check=True, precheck=False, *args, **kwargs):
    def check_pass(item):
        status = check_status[server]
        if status[item].status == err.CheckStatus.WAIT:
            status[item].status = err.CheckStatus.PASS
    def check_fail(item, error, suggests=[]):
        status = check_status[server][item]
        if status.status == err.CheckStatus.WAIT:
            status.error = error
            status.suggests = suggests
            status.status = err.CheckStatus.FAIL
    def wait_2_pass():
        status = check_status[server]
        for item in status:
            check_pass(item)
    def alert(item, error, suggests=[]):
        global success
        if strict_check:
            success = False
            check_fail(item, error, suggests)
            stdio.error(error)
        else:
            stdio.warn(error)
    def critical(item, error, suggests=[]):
        global success
        success = False
        check_fail(item, error, suggests)
        stdio.error(error)
                
    global stdio, success
    success = True
    cluster_config = plugin_context.cluster_config
    clients = plugin_context.clients
    stdio = plugin_context.stdio
    servers_port = {}
    servers_dirs = {}
    servers_check_dirs = {}
    check_status = {}
    plugin_context.set_variable('start_check_status', check_status)
    for server in cluster_config.servers:
        check_status[server] = {
            'port': err.CheckStatus(),
        }
        if work_dir_check:
             check_status[server]['dir'] = err.CheckStatus()

    if init_check_status:
        return plugin_context.return_true(start_check_status=check_status)
    
    stdio.start_loading('Check before start obagent')
    for server in cluster_config.servers:
        ip = server.ip
        client = clients[server]
        server_config = cluster_config.get_server_conf(server)
        if not precheck:
            remote_pid_path = "%s/run/obagent-%s-%s.pid" % (server_config['home_path'], server.ip, server_config["server_port"])
            remote_pid = client.execute_command("cat %s" % remote_pid_path).stdout.strip()
            if remote_pid:
                if client.execute_command('ls /proc/%s' % remote_pid):
                    stdio.verbose('%s is runnning, skip' % server)
                    wait_2_pass()
                    continue

        if work_dir_check:
            stdio.verbose('%s dir check' % server)   
            if ip not in servers_dirs:
                servers_dirs[ip] = {}
                servers_check_dirs[ip] = {}
            dirs = servers_dirs[ip]
            check_dirs = servers_check_dirs[ip]
            key = 'home_path'
            path = server_config.get(key)
            suggests = [err.SUG_CONFIG_CONFLICT_DIR.format(key=key, server=server)]
            if path in dirs and dirs[path]:
                critical('dir', err.EC_CONFIG_CONFLICT_DIR.format(server1=server, path=path, server2=dirs[path]['server'], key=dirs[path]['key']), suggests)
            dirs[path] = {
                'server': server,
                'key': key,
            }
            empty_check = work_dir_empty_check
            while True:
                if path in check_dirs:
                    if check_dirs[path] != True:
                        critical('dir', check_dirs[path], suggests)
                    break

                if client.execute_command('bash -c "[ -a %s ]"' % path):
                    is_dir = client.execute_command('[ -d {} ]'.format(path))
                    has_write_permission = client.execute_command('[ -w {} ]'.format(path))
                    if is_dir and has_write_permission:
                        if empty_check:
                            ret = client.execute_command('ls %s' % path)
                            if not ret or ret.stdout.strip():
                                check_dirs[path] = err.EC_FAIL_TO_INIT_PATH.format(server=server, key=key, msg=err.InitDirFailedErrorMessage.NOT_EMPTY.format(path=path))
                            else:
                                check_dirs[path] = True
                        else:
                            check_dirs[path] = True
                    else:
                        if not is_dir:
                            check_dirs[path] = err.EC_FAIL_TO_INIT_PATH.format(server=server, key=key, msg=err.InitDirFailedErrorMessage.NOT_DIR.format(path=path))
                        else:
                            check_dirs[path] = err.EC_FAIL_TO_INIT_PATH.format(server=server, key=key, msg=err.InitDirFailedErrorMessage.PERMISSION_DENIED.format(path=path))
                else:
                    path = os.path.dirname(path)
                    empty_check = False
        
        if ip not in servers_port:
            servers_port[ip] = {}
        ports = servers_port[ip]
        server_config = cluster_config.get_server_conf_with_default(server)
        stdio.verbose('%s port check' % server)
        for key in ['server_port', 'pprof_port']:
            port = int(server_config[key])
            alert_f = alert if key == 'pprof_port' else critical
            if port in ports:
                alert_f(
                    'port', 
                    err.EC_CONFIG_CONFLICT_PORT.format(server1=server, port=port, server2=ports[port]['server'], key=ports[port]['key']),
                    [err.SUG_PORT_CONFLICTS.format()]
                )
                continue
            ports[port] = {
                'server': server,
                'key': key
            }
            if get_port_socket_inode(client, port):
                alert_f(
                    'port', 
                    err.EC_CONFLICT_PORT.format(server=ip, port=port),
                    [err.SUG_USE_OTHER_PORT.format()]
                )

    for server in cluster_config.servers:
        wait_2_pass()
                
    if success:
        stdio.stop_loading('succeed')
        plugin_context.return_true()
    else:
        stdio.stop_loading('fail')