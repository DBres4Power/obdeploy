declare namespace API {
  interface TableComponentInfo {
    key: string;
    name?: string | Element;
    showComponentName?: string;
    desc?: string;
    version?: string;
    doc?: string;
    onlyAll?: boolean;
  }

  interface DBConfig {
    id: string;
    name: string;
    rootservice: string;
    servers: string[];
  }

  interface Components {
    oceanbase?: any;
    obproxy?: any;
    ocpexpress?: any;
    obagent?: any;
    ocpserver?: any;
  }

  interface MoreParameter extends API.Parameter {
    description: string;
    auto: boolean;
  }

  interface ParameterValue {
    adaptive?: boolean;
    value?: string;
    auto?: boolean;
    require?: boolean;
    type?: string;
  }

  interface NewConfigParameter extends API.ConfigParameter {
    parameterValue: ParameterValue;
  }

  interface NewParameterMeta extends API.ParameterMeta {
    label: string;
    componentKey: string;
    configParameter: NewConfigParameter[];
  }

  interface ComponentsVersionInfo {
    oceanbase?: any;
    obproxy?: any;
    ocpexpress?: any;
    obagent?: any;
  }

  interface ErrorInfo {
    title: string;
    desc?: string;
  }

  interface StepProp {
    setCurrent: React.Dispatch<React.SetStateAction<number>>;
    current: number;
  }
}
