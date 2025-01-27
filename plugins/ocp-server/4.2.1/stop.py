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
import time


def get_port_socket_inode(client, port, stdio):
    port = hex(port)[2:].zfill(4).upper()
    cmd = "bash -c 'cat /proc/net/{tcp*,udp*}' | awk -F' ' '{print $2,$10}' | grep '00000000:%s' | awk -F' ' '{print $2}' | uniq" % port
    res = client.execute_command(cmd)
    if not res or not res.stdout.strip():
        return False
    stdio.verbose(res.stdout)
    return res.stdout.strip().split('\n')


def confirm_port(client, pid, port, stdio):
    socket_inodes = get_port_socket_inode(client, port, stdio)
    if not socket_inodes:
        return False
    ret = client.execute_command("ls -l /proc/%s/fd/ |grep -E 'socket:\[(%s)\]'" % (pid, '|'.join(socket_inodes)))
    if ret and ret.stdout.strip():
        return True
    return False


def stop(plugin_context, *args, **kwargs):
    cluster_config = plugin_context.cluster_config
    clients = plugin_context.clients
    stdio = plugin_context.stdio
    servers = {}
    stdio.start_loading('Stop ocp-server')
    success = True
    for server in cluster_config.servers:
        server_config = cluster_config.get_server_conf(server)
        client = clients[server]
        home_path = server_config['home_path']
        pid_path = os.path.join(home_path, 'run/ocp-server.pid')
        launch_user = server_config.get('launch_user', None)
        cmd = 'cat {}'.format(pid_path)
        pids = client.execute_command('sudo ' + cmd if launch_user else cmd).stdout.strip().split('\n')
        for pid in pids:
            cmd = 'ls /proc/{}'.format(pid)
            if pid and client.execute_command('sudo ' + cmd if launch_user else cmd):
                cmd = 'ls /proc/{}/fd'.format(pid)
                if client.execute_command('sudo ' + cmd if launch_user else cmd):
                    stdio.verbose('{} ocp-server[pid: {}] stopping...'.format(server, pid))
                    cmd = 'kill -9 {}'.format(pid)
                    client.execute_command('sudo ' + cmd if launch_user else cmd)
                else:
                    stdio.verbose('failed to stop ocp-server[pid:{}] in {}, permission deny'.format(pid, server))
                    success = False
            else:
                stdio.verbose('{} ocp-server is not running'.format(server))
        if not success:
            stdio.stop_loading('fail')
            return plugin_context.return_true()

    count = 10
    check = lambda client, pid, port: confirm_port(client, pid, port, stdio) if count < 5 else get_port_socket_inode(client, port, stdio)
    time.sleep(1)
    while count and servers:
        tmp_servers = {}
        for server in servers:
            data = servers[server]
            client = clients[server]
            stdio.verbose('%s check whether the port is released' % server)
            for key in ['port']:
                if data[key] and check(data['client'], data['pid'], data[key]):
                    tmp_servers[server] = data
                    break
                data[key] = ''
            else:
                client.execute_command('rm -rf %s' % data['path'])
                stdio.verbose('%s ocp-server is stopped', server)
        servers = tmp_servers
        count -= 1
        if count and servers:
            time.sleep(3)
    if servers:
        stdio.stop_loading('fail')
        for server in servers:
            stdio.warn('%s port not released'%  server)
    else:
        stdio.stop_loading('succeed')
        return plugin_context.return_true()