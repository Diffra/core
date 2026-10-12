declare module '@actions/core' {
  export interface InputOptions {
    required?: boolean;
    trimWhitespace?: boolean;
  }

  export interface AnnotationProperties {
    title?: string;
    file?: string;
    startLine?: number;
    endLine?: number;
    startColumn?: number;
    endColumn?: number;
  }

  export interface Summary {
    addRaw(text: string, addNewline?: boolean): Summary;
    write(): Promise<Summary>;
  }

  export function getInput(name: string, options?: InputOptions): string;
  export function setOutput(name: string, value: unknown): void;
  export function setSecret(secret: string): void;
  export function setFailed(message: string | Error): void;
  export function info(message: string): void;
  export function warning(
    message: string,
    properties?: AnnotationProperties,
  ): void;
  export const summary: {
    addRaw(
      text: string,
      addNewline?: boolean,
    ): {
      write(): Promise<unknown>;
    };
  };
}

declare module '@actions/github' {
  export interface GitHubContext {
    ref: string;
    payload: {
      repository?: {
        default_branch?: string;
      };
      pull_request?: {
        number?: number;
      };
      issue?: {
        number?: number;
      };
      number?: number;
    };
    repo: {
      owner: string;
      repo: string;
    };
  }

  export const context: GitHubContext;
}
