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

import uuid
import tempfile
from service.handler.base_handler import BaseHandler
from service.model.components import Component, ComponentInfo, ConfigParameter, ParameterMeta
from service.common import log
from _mirror import MirrorRepositoryType
from _plugin import PluginType
from _repository import Repository
from singleton_decorator import singleton
from collections import defaultdict
from _rpm import Version
from service.common import const

def map_to_config_parameter(param, is_cn):
    log.get_logger().info("param {0} type: {1}".format(param.name, param._param_type.__name__))
    config_parameter = ConfigParameter()
    config_parameter.auto = False
    config_parameter.name = param.name
    config_parameter.is_essential = param.essential
    config_parameter.require = param.require
    config_parameter.type = param._param_type.__name__
    config_parameter.default = str(param.default) if param.default is not None else ""
    config_parameter.min_value = str(param.min_value) if param.min_value is not None else ""
    config_parameter.max_value = str(param.max_value) if param.max_value is not None else ""
    config_parameter.modify_limit = param.modify_limit.__name__
    config_parameter.need_restart = param.need_restart
    config_parameter.need_redeploy = param.need_redeploy
    config_parameter.need_reload = param.need_reload
    config_parameter.section = param.section
    config_parameter.description = param.description_local if is_cn else param.description_en
    return config_parameter

@singleton
class ComponentHandler(BaseHandler):


    def __get_all_components(self, component_filter=const.VERSION_FILTER):
        local_packages = self.obd.mirror_manager.local_mirror.get_all_pkg_info()
        remote_packages = list()
        remote_mirrors = self.obd.mirror_manager.get_remote_mirrors()
        for mirror in remote_mirrors:
            remote_packages.extend(mirror.get_all_pkg_info())
        local_packages.sort()
        remote_packages.sort()
        local_pkg_idx = len(local_packages) - 1
        remote_pkg_idx = len(remote_packages) - 1
        component_dict = defaultdict(list)
        while local_pkg_idx >= 0 and remote_pkg_idx >= 0:
            local_pkg = local_packages[local_pkg_idx]
            remote_pkg = remote_packages[remote_pkg_idx]
            if local_pkg >= remote_pkg:
                component_dict[local_pkg.name].append(
                    ComponentInfo(version=local_pkg.version, md5=local_pkg.md5, release=local_pkg.release,
                                  arch=local_pkg.arch, type=MirrorRepositoryType.LOCAL.value, estimated_size=const.PKG_ESTIMATED_SIZE[local_pkg.name]))
                local_pkg_idx -= 1
            else:
                if len(component_dict[remote_pkg.name]) > 0 and component_dict[remote_pkg.name][-1].md5 == remote_pkg.md5:
                    log.get_logger().debug("already found local package %s", remote_pkg)
                else:
                    component_dict[remote_pkg.name].append(
                        ComponentInfo(version=remote_pkg.version, md5=remote_pkg.md5, release=remote_pkg.release,
                                      arch=remote_pkg.arch, type=MirrorRepositoryType.REMOTE.value, estimated_size=const.PKG_ESTIMATED_SIZE[remote_pkg.name]))
                remote_pkg_idx -= 1
        if local_pkg_idx >= 0:
            for pkg in local_packages[local_pkg_idx::-1]:
                component_dict[pkg.name].append(
                    ComponentInfo(version=pkg.version, md5=pkg.md5, release=pkg.release, arch=pkg.arch, type=MirrorRepositoryType.LOCAL.value, estimated_size=const.PKG_ESTIMATED_SIZE[pkg.name]))
        if remote_pkg_idx >= 0:
            for pkg in remote_packages[remote_pkg_idx::-1]:
                component_dict[pkg.name].append(
                    ComponentInfo(version=pkg.version, md5=pkg.md5, release=pkg.release, arch=pkg.arch, type=MirrorRepositoryType.REMOTE.value, estimated_size=const.PKG_ESTIMATED_SIZE[pkg.name]))
        for component, version in component_filter.items():
            if component in component_dict.keys():
                log.get_logger().info("filter component: {0} above version: {1}".format(component, version))
                log.get_logger().info("original components: {0}".format(component_dict[component]))
                component_dict[component] = list(filter(lambda c: Version(c.version) >= Version(version), component_dict[component]))
                log.get_logger().info("filtered components: {0}".format(component_dict[component]))
        return component_dict

    def list_components(self):
        if self.context['mirror']['remote_mirror_info_status'] != const.FINISHED:
            raise Exception("startup event mirror update still not finished")
        component_list = list()
        component_dict = self.__get_all_components()
        for componentInfo in component_dict[const.OCEANBASE_CE]:
            componentInfo.version_type = const.CE
        for componentInfo in component_dict[const.OCEANBASE]:
            componentInfo.version_type = const.BUSINESS
        for componentInfo in component_dict[const.OBPROXY_CE]:
            componentInfo.version_type = const.CE
        for componentInfo in component_dict[const.OBPROXY]:
            componentInfo.version_type = const.BUSINESS
        for componentInfo in component_dict[const.OCP_SERVER_CE]:
            componentInfo.version_type = const.CE
        for componentInfo in component_dict[const.OCP_SERVER]:
            componentInfo.version_type = const.BUSINESS

        if const.OCEANBASE in component_dict.keys() and const.OCEANBASE_CE in component_dict.keys():
            component_dict[const.OCEANBASE].extend(component_dict[const.OCEANBASE_CE])
            component_dict.pop(const.OCEANBASE_CE)
            component_dict[const.OCEANBASE].sort(key=lambda x: x.version, reverse=True)
        elif const.OCEANBASE_CE in component_dict.keys():
            component_dict[const.OCEANBASE] = component_dict[const.OCEANBASE_CE]
            component_dict.pop(const.OCEANBASE_CE)
        if const.OBPROXY in component_dict.keys() and const.OBPROXY_CE in component_dict.keys():
            component_dict[const.OBPROXY].extend(component_dict[const.OBPROXY_CE])
            component_dict.pop(const.OBPROXY_CE)
            component_dict[const.OBPROXY].sort(key=lambda x: x.version, reverse=True)
        elif const.OBPROXY_CE in component_dict.keys():
            component_dict[const.OBPROXY] = component_dict[const.OBPROXY_CE]
            component_dict.pop(const.OBPROXY_CE)
        if const.OCP_SERVER in component_dict.keys() and const.OCP_SERVER_CE in component_dict.keys():
            component_dict[const.OCP_SERVER].extend(component_dict[const.OCP_SERVER_CE])
            component_dict.pop(const.OCP_SERVER_CE)
            component_dict[const.OCP_SERVER].sort(key=lambda x: x.version, reverse=True)
        elif const.OCP_SERVER_CE in component_dict.keys():
            component_dict[const.OCP_SERVER] = component_dict[const.OCP_SERVER_CE]
            component_dict.pop(const.OCP_SERVER_CE)
        for name, info in component_dict.items():
            component_list.append(Component(name=name, info=info))
        return component_list

    def get_component(self, component_name):
        if self.context['mirror']['remote_mirror_info_status'] != const.FINISHED:
            raise Exception("startup event mirror update still not finished")
        component = None
        component_dict = self.__get_all_components()
        if component_name in component_dict.keys():
            component = Component(name=component_name, info=component_dict[component_name])
        return component


    def list_component_parameters(self, parameter_request, accept_language):
        parameter_metas = list()
        for parameter_filter in parameter_request.filters:
            name=uuid.uuid4().hex
            # generate minimal deploy
            config_path = ''
            log.get_logger().info('dump config')
            with tempfile.NamedTemporaryFile(prefix="obd", suffix="yaml", mode="w", encoding="utf-8") as f:
                f.write(const.MINIMAL_CONFIG.format(parameter_filter.component))
                f.flush()
                config_path = f.name
                deploy = self.obd.deploy_manager.create_deploy_config(name, config_path)
            if deploy is None:
                raise Exception("create temp deployment failed")
            self.obd.set_deploy(deploy)

            spacename = "{0}_parameter".format(parameter_filter.component)
            gen_config_plugin = self.obd.plugin_manager.get_best_py_script_plugin("generate_config", parameter_filter.component, parameter_filter.version)
            repository = Repository(parameter_filter.component, "")
            self.obd.set_repositories([repository])
            ret = self.obd.call_plugin(gen_config_plugin, repository, return_generate_keys=True, generate_consistent_config=True, spacename=spacename, clients={})
            del(self.obd.namespaces[spacename])
            if not ret:
                self.obd.deploy_manager.remove_deploy_config(name)
                raise Exception("genconfig failed for compoennt: {0}".format(parameter_filter.component))
            else:
                auto_keys = ret.get_return("generate_keys")
            log.get_logger().info("auto keys for comopnent %s are %s", parameter_filter.component, auto_keys)

            parameter_plugin = self.obd.plugin_manager.get_best_plugin(PluginType.PARAM, parameter_filter.component, parameter_filter.version)
            ## use plugin.params to generate parameter meta
            config_parameters = list()
            is_cn = 'zh-CN' in accept_language
            for param in parameter_plugin.params.values():
                config_parameter = map_to_config_parameter(param, is_cn)
                if config_parameter.name in auto_keys:
                    config_parameter.auto = True
                if config_parameter.is_essential or not parameter_filter.is_essential_only:
                    config_parameters.append(config_parameter)
            parameter_metas.append(ParameterMeta(component=parameter_filter.component, version=parameter_filter.version, config_parameters=config_parameters))
            self.obd.deploy_manager.remove_deploy_config(name)
        return parameter_metas
