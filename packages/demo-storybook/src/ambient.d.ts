/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

declare namespace React {
  export type ReactNode =
    | ReactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>;

  export interface ReactElement<
    P = any,
    T extends string | JSXElementConstructor<any> = any,
  > {
    type: T;
    props: P;
    key: string | null;
  }

  export type JSXElementConstructor<P> =
    | ((props: P) => ReactElement<any, any> | null)
    | (new (
        props: P,
      ) => any);

  export type FC<P = {}> = (props: P) => ReactElement<any, any> | null;
  export type ComponentType<P = {}> = FC<P> | (new (props: P) => any);

  export interface CSSProperties {
    [key: string]: any;
  }

  export interface SyntheticEvent<E = Event, T = any> {
    nativeEvent: E;
    currentTarget: T;
    target: T;
    preventDefault(): void;
    stopPropagation(): void;
  }

  export interface MouseEvent<T = any>
    extends SyntheticEvent<globalThis.MouseEvent, T> {
    button: number;
    clientX: number;
    clientY: number;
  }

  export interface DOMAttributes<T> {
    children?: ReactNode;
    onClick?: (event: MouseEvent<T>) => void;
  }

  export interface HTMLAttributes<T> extends DOMAttributes<T> {
    className?: string;
    style?: CSSProperties;
    id?: string;
    title?: string;
    [key: string]: any;
  }

  export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    type?: 'submit' | 'reset' | 'button';
    disabled?: boolean;
    onClick?: (event: MouseEvent<T>) => void;
  }
}

declare module 'react' {
  export = React;
  export as namespace React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
}

declare namespace JSX {
  interface Element extends React.ReactElement<any, any> {}
  interface ElementClass {
    render(): any;
  }
  interface ElementAttributesProperty {
    props: {};
  }
  interface ElementChildrenAttribute {
    children: {};
  }
  interface IntrinsicElements {
    div: React.HTMLAttributes<HTMLDivElement>;
    span: React.HTMLAttributes<HTMLSpanElement>;
    p: React.HTMLAttributes<HTMLParagraphElement>;
    h1: React.HTMLAttributes<HTMLHeadingElement>;
    h2: React.HTMLAttributes<HTMLHeadingElement>;
    h3: React.HTMLAttributes<HTMLHeadingElement>;
    button: React.ButtonHTMLAttributes<HTMLButtonElement>;
    [elemName: string]: React.HTMLAttributes<any>;
  }
}

declare module '@storybook/react' {
  export interface Parameters {
    [key: string]: any;
  }

  export interface Preview {
    parameters?: Parameters;
    [key: string]: any;
  }

  export interface Meta<TComponent = any> {
    title?: string;
    component?: TComponent;
    parameters?: Parameters;
    args?: Record<string, any>;
    [key: string]: any;
  }

  export interface StoryObj<TComponent = any> {
    args?: Record<string, any>;
    parameters?: Parameters;
    render?: (args: any) => any;
    play?: (context: any) => Promise<void> | void;
    [key: string]: any;
  }
}

declare module '@storybook/react-vite' {
  export interface StorybookConfig {
    stories: string[];
    addons: string[];
    framework: {
      name: string;
      options?: Record<string, any>;
    };
    [key: string]: any;
  }
}

declare module '@storybook/addon-essentials' {
  const content: any;
  export default content;
}
