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
from typing import List, Optional, Union
from enum import auto
from fastapi import Body
from fastapi_utils.enums import StrEnum
from pydantic import BaseModel

from service.model.ssh import SshAuth
from service.model.parameter import Parameter
from service.model.deployments import OCPDeploymentStatus
from service.model.tenant import TenantConfig
from service.model.resource import ServerResource
from service.model.task import TaskStatus, TaskResult
from service.model.database import DatabaseConnection
from service.model.backup import BackupMethod


class OcpDeploymentConfig(BaseModel):
    auth: SshAuth = Body(None, description="ssh auth info")
    metadb: Union[int, DatabaseConnection] = Body(..., description="connection info of metadb")
    meta_tenant: Optional[TenantConfig] = Body(None, description="meta tenant config")
    monitor_tenant: Optional[TenantConfig] = Body(None, description="monitor tenant config")
    appname: str = Body("ocp", description="ocp app name")
    admin_password: str = Body('', description="ocp login password")
    servers: List[str] = Body(..., description="servers to deploy")
    home_path: str = Body("", description="home path to install")
    server_port: int = Body(8080, description="server port")
    parameters: Optional[List[Parameter]]


class OcpDeploymentInfo(BaseModel):
    id: int = Body(0, description="metadb deployment id")
    status: OCPDeploymentStatus = Body(OCPDeploymentStatus.INIT, description="ocp deployment status, ex: INIT, DEPLOYING, FINISHED")
    config: Optional[OcpDeploymentConfig] = Body(..., description="ocp deployment config")
    monitor_display: bool = Body(True, description="monitor tenant configured")


class ObserverResource(BaseModel):
    address: str = Body(..., description="observer address")
    cpu_total: float = Body(..., description="total cpu")
    cpu_free: float = Body(..., description="free cpu")
    memory_total: int = Body(..., description="total memory size")
    memory_free: int = Body(..., description="free memory size")


class MetadbResource(BaseModel):
    servers: List[ObserverResource] = Body(..., description="observer resource")


class OcpResource(BaseModel):
    servers: List[ServerResource] = Body(..., description="server resource")
    metadb: MetadbResource = Body(..., description="metadb resource")


class OcpDeploymentReport(BaseModel):
    status: TaskStatus = Body(..., description="task status")
    result: TaskResult = Body(..., description="task result")
    servers: List[str] = Body(..., description="ocp server addresses")
    user: str = Body(..., description="ocp admin user")
    password: str = Body(..., description="ocp admin password")


class OcpInfo(BaseModel):
    cluster_name: str = Body('', description="ocp deployment cluster_name")
    status: OCPDeploymentStatus = Body(OCPDeploymentStatus.INIT, description="ocp deployment status, ex:INIT, FINISHED")
    current_version: str = Body(..., description="current ocp version")
    ocp_servers: List[str] = Body(..., description="ocp servers")
    agent_servers: List[str] = Body(None, description="servers deployed agent")


class OcpBackupConfig(BaseModel):
    method: BackupMethod = Body(BackupMethod.DUMP, description="backup method, ex: DUMP, DATA_BACKUP")
    destination: str = Body(..., description="backup destination")
    tenants: List[str] = Body(..., description="backup tenants")
    root_password: Optional[str] = Body(..., description="root password of metadb")


class OcpBackupInfo(BaseModel):
    id: int = Body(0, description="backup id")
    status: OCPDeploymentStatus = Body(OCPDeploymentStatus.INIT, description="backup status, ex: INIT, RUNNING, FINISHED")
    config: OcpBackupConfig = Body(..., description="backup config")


class OcpInstalledInfo(BaseModel):
    url: List[str] = Body(..., description="Access address, eq: ip:port")
    account: str = Body('admin', description="account")
    password: str = Body(..., description="account password")


class OcpUpgradeLostAddress(BaseModel):
    address: List[str] = Body([], description="lost ip address")

