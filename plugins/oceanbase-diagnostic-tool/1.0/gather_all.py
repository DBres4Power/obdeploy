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
import datetime

from subprocess import call, Popen, PIPE

from ssh import LocalClient
from tool import TimeUtils
from _rpm import Version
import _errno as err


def gather_all(plugin_context, *args, **kwargs):
    def get_option(key, default=''):
        value = getattr(options, key)
        if value is None:
            value = default
        stdio.verbose('get option: %s value %s' % (key, value))
        return value

    def local_execute_command(command, env=None, timeout=None):
        command = r"cd {install_dir} && sh ".format(install_dir=obdiag_install_dir) + command
        return LocalClient.execute_command(command, env, timeout, stdio)

    def get_obdiag_cmd():
        base_commond=r"cd {install_dir} && ./obdiag gather all".format(install_dir=obdiag_install_dir)
        cmd = r"{base} --cluster_name {cluster_name} --from {from_option} --to {to_option} --scope {scope_option} --encrypt {encrypt_option}".format(
            base=base_commond,
            cluster_name=cluster_name,
            from_option=from_option,
            to_option=to_option,
            scope_option=scope_option,
            encrypt_option=encrypt_option,
        )
        if grep_option:
            cmd = cmd + r" --grep {grep_option}".format(grep_option=grep_option)
        if ob_install_dir_option:
            cmd = cmd + r" --ob_install_dir {ob_install_dir_option}".format(ob_install_dir_option=ob_install_dir_option)
        if store_dir_option:
            cmd = cmd + r" --store_dir {store_dir_option}".format(store_dir_option=store_dir_option)
        if clog_dir:
            cmd = cmd + r" --clog_dir {clog_dir}".format(clog_dir=clog_dir)
        if slog_dir:
            cmd = cmd + r" --slog_dir {slog_dir}".format(slog_dir=slog_dir)
        return cmd

    def run():
        obdiag_cmd = get_obdiag_cmd()
        stdio.verbose('execute cmd: {}'.format(obdiag_cmd))
        return LocalClient.run_command(obdiag_cmd, env=None, stdio=stdio)

    options = plugin_context.options
    obdiag_bin = "obdiag"
    cluster_config = plugin_context.cluster_config
    cluster_name = cluster_config.name
    stdio = plugin_context.stdio
    global_conf = cluster_config.get_global_conf()
    from_option = get_option('from')
    to_option = get_option('to')
    scope_option = get_option('scope')
    since_option = get_option('since')
    grep_option = get_option('grep')
    encrypt_option = get_option('encrypt')
    store_dir_option = os.path.abspath(get_option('store_dir'))
    ob_install_dir_option = global_conf.get('home_path')
    obdiag_install_dir = get_option('obdiag_dir')
    clog_dir = ob_install_dir_option + "/store"
    slog_dir = ob_install_dir_option + "/store"

    if len(cluster_config.servers) > 0:
        server_config = cluster_config.get_server_conf(cluster_config.servers[0])
        if not server_config.get('data_dir'):
            server_config['data_dir'] = '%s/store' % ob_install_dir_option
        if not server_config.get('redo_dir'):
            server_config['redo_dir'] = server_config['data_dir']
        if not server_config.get('slog_dir'):
            mount_key = 'redo_dir' if Version('4.0') > cluster_config.version else 'data_dir'
            server_config['slog_dir'] = '%s/slog' % server_config[mount_key]
        if not server_config.get('clog_dir'):
            server_config['clog_dir'] = '%s/clog' % server_config['redo_dir']
        clog_dir = server_config['clog_dir']
        slog_dir = server_config['slog_dir']

    from_option, to_option, ok = TimeUtils.parse_time_from_to(from_time=from_option, to_time=to_option, stdio=stdio)
    if not ok:
        from_option, to_option = TimeUtils.parse_time_since(since=since_option)

    ret = local_execute_command('%s --help' % obdiag_bin)
    if not ret:
        stdio.error(err.EC_OBDIAG_NOT_FOUND.format())
        return plugin_context.return_false()
    try:
        if run():
            plugin_context.return_true()
    except KeyboardInterrupt:
        stdio.exception("obdiag gather all failded")
        return plugin_context.return_false()