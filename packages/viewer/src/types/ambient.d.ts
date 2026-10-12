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

  export interface RefObject<T> {
    readonly current: T;
  }

  export interface MutableRefObject<T> {
    current: T;
  }

  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type Dispatch<A> = (value: A) => void;

  export function useState<S>(
    initialState: S | (() => S),
  ): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [
    S | undefined,
    Dispatch<SetStateAction<S | undefined>>,
  ];

  export type EffectCallback = () => void | (() => void);
  export type DependencyList = readonly unknown[];
  export function useEffect(
    effect: EffectCallback,
    deps?: DependencyList,
  ): void;

  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;

  export function useMemo<T>(
    factory: () => T,
    deps: DependencyList | undefined,
  ): T;
  export function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: DependencyList,
  ): T;

  export interface Context<T> {
    Provider: FC<{ value: T; children?: ReactNode }>;
    Consumer: FC<{ children: (value: T) => ReactNode }>;
    displayName?: string;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;

  export interface CSSProperties {
    [key: string]: any;
  }

  export interface SyntheticEvent<E = Event, T = any> {
    nativeEvent: E;
    currentTarget: T;
    target: T;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    preventDefault(): void;
    stopPropagation(): void;
    persist(): void;
    timeStamp: number;
    type: string;
  }

  export interface ChangeEvent<T = any> extends SyntheticEvent<Event, T> {
    target: T;
  }

  export interface MouseEvent<T = any>
    extends SyntheticEvent<globalThis.MouseEvent, T> {
    altKey: boolean;
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    ctrlKey: boolean;
    metaKey: boolean;
    movementX: number;
    movementY: number;
    pageX: number;
    pageY: number;
    screenX: number;
    screenY: number;
    shiftKey: boolean;
  }

  export interface KeyboardEvent<T = any>
    extends SyntheticEvent<globalThis.KeyboardEvent, T> {
    altKey: boolean;
    ctrlKey: boolean;
    key: string;
    keyCode: number;
    metaKey: boolean;
    repeat: boolean;
    shiftKey: boolean;
  }

  export interface DOMAttributes<T> {
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    onChange?: (event: ChangeEvent<T>) => void;
    onInput?: (event: ChangeEvent<T>) => void;
    onClick?: (event: MouseEvent<T>) => void;
    onMouseDown?: (event: MouseEvent<T>) => void;
    onMouseUp?: (event: MouseEvent<T>) => void;
    onMouseMove?: (event: MouseEvent<T>) => void;
    onMouseEnter?: (event: MouseEvent<T>) => void;
    onMouseLeave?: (event: MouseEvent<T>) => void;
    onKeyDown?: (event: KeyboardEvent<T>) => void;
    onKeyUp?: (event: KeyboardEvent<T>) => void;
    onScroll?: (event: SyntheticEvent<Event, T>) => void;
  }

  export interface HTMLAttributes<T> extends DOMAttributes<T> {
    className?: string;
    style?: CSSProperties;
    id?: string;
    title?: string;
    role?: string;
    tabIndex?: number;
    ref?: any;
    key?: string | number | null;
    [key: string]: any;
  }

  export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    type?: 'submit' | 'reset' | 'button';
    disabled?: boolean;
    autoFocus?: boolean;
    name?: string;
    value?: string | number | readonly string[];
  }

  export interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    type?: string;
    value?: string | number | readonly string[];
    defaultValue?: string | number | readonly string[];
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    autoFocus?: boolean;
    checked?: boolean;
    name?: string;
  }

  export const StrictMode: FC<{ children?: ReactNode }>;
  export const Fragment: FC<{ children?: ReactNode }>;
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
    h4: React.HTMLAttributes<HTMLHeadingElement>;
    button: React.ButtonHTMLAttributes<HTMLButtonElement>;
    input: React.InputHTMLAttributes<HTMLInputElement>;
    select: React.HTMLAttributes<HTMLSelectElement>;
    option: React.HTMLAttributes<HTMLOptionElement>;
    label: React.HTMLAttributes<HTMLLabelElement>;
    a: React.HTMLAttributes<HTMLAnchorElement>;
    img: React.HTMLAttributes<HTMLImageElement>;
    canvas: React.HTMLAttributes<HTMLCanvasElement>;
    header: React.HTMLAttributes<HTMLElement>;
    main: React.HTMLAttributes<HTMLElement>;
    aside: React.HTMLAttributes<HTMLElement>;
    nav: React.HTMLAttributes<HTMLElement>;
    section: React.HTMLAttributes<HTMLElement>;
    svg: React.HTMLAttributes<SVGSVGElement>;
    path: React.HTMLAttributes<SVGPathElement>;
    rect: React.HTMLAttributes<SVGRectElement>;
    circle: React.HTMLAttributes<SVGCircleElement>;
    kbd: React.HTMLAttributes<HTMLElement>;
    code: React.HTMLAttributes<HTMLElement>;
    pre: React.HTMLAttributes<HTMLPreElement>;
    [elemName: string]: React.HTMLAttributes<any>;
  }
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare module 'wouter' {
  export function useLocation(): [string, (to: string) => void];
  export function Route(props: any): any;
  export function Switch(props: any): any;
  export function Link(props: any): any;
}

declare module 'wouter/use-hash-location' {
  export function useHashLocation(): [string, (to: string) => void];
}

declare module 'lucide-react' {
  import type { FC } from 'react';
  export interface LucideProps {
    color?: string;
    size?: string | number;
    strokeWidth?: string | number;
    className?: string;
    [key: string]: any;
  }
  export type LucideIcon = FC<LucideProps>;

  export const AlertCircle: LucideIcon;
  export const Check: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Columns2: LucideIcon;
  export const Eye: LucideIcon;
  export const FileText: LucideIcon;
  export const Layers: LucideIcon;
  export const LayoutGrid: LucideIcon;
  export const ListFilter: LucideIcon;
  export const Loader2: LucideIcon;
  export const Pause: LucideIcon;
  export const ScanEye: LucideIcon;
  export const Search: LucideIcon;
  export const SlidersHorizontal: LucideIcon;
  export const SquareDashed: LucideIcon;
  export const X: LucideIcon;
}

declare module '*.css' {
  const content: string;
  export default content;
}
