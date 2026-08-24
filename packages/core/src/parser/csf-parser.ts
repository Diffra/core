import { parseSync } from 'oxc-parser';
import type {
  SnapshotStoryParameters,
  StoryMetadata,
  Viewport,
  ViewportInput,
} from '../types/index.js';

function toKebabCase(str: string): string {
  return str
    .trim()
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[/\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[^\w]+|[^\w]+$/g, '');
}

export function toStoryId(title: string, storyName: string): string {
  return `${toKebabCase(title)}--${toKebabCase(storyName)}`;
}

export function normalizeViewport(vp: ViewportInput): Viewport {
  if (typeof vp === 'number') {
    return {
      name: `${vp}px`,
      width: vp,
      height: 800,
    };
  }
  return {
    name: vp.name || `${vp.width}x${vp.height}`,
    width: vp.width,
    height: vp.height || 800,
  };
}

type AstNode = Record<string, unknown>;

function extractLiteralValue(node: AstNode | null | undefined): unknown {
  if (!node) return undefined;
  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    return node.value;
  }
  if (node.type === 'NumericLiteral') {
    return node.value;
  }
  if (node.type === 'BooleanLiteral') {
    return node.value;
  }
  if (node.type === 'ArrayExpression') {
    return ((node.elements as AstNode[]) || []).map((el) =>
      extractLiteralValue(el),
    );
  }
  if (node.type === 'ObjectExpression') {
    const obj: Record<string, unknown> = {};
    for (const prop of (node.properties as AstNode[]) || []) {
      const key = (prop.key as AstNode)?.name || (prop.key as AstNode)?.value;
      if (typeof key === 'string') {
        obj[key] = extractLiteralValue(prop.value as AstNode);
      }
    }
    return obj;
  }
  if (node.type === 'Identifier') {
    return node.name;
  }
  return undefined;
}

/**
 * Storybook CSF AST parser using OXC (Rust).
 * Extracts standard Storybook parameters.snapshot (delay, diffThreshold, modes, viewports, disableSnapshot).
 */
export function parseCSF(
  code: string,
  filePath = 'story.tsx',
): StoryMetadata[] {
  let ast: { body?: AstNode[] } | null = null;
  try {
    const parseResult = parseSync(filePath, code);
    ast = parseResult.program as unknown as { body?: AstNode[] };
  } catch {
    return parseCSFFallback(code, filePath);
  }

  if (!ast?.body) {
    return parseCSFFallback(code, filePath);
  }

  const varDeclarations = new Map<string, AstNode>();
  let defaultExportNode: AstNode | null = null;
  const namedStories: Array<{
    name: string;
    params: Record<string, unknown>;
  }> = [];

  for (const node of ast.body) {
    if (node.type === 'VariableDeclaration') {
      for (const decl of (node.declarations as AstNode[]) || []) {
        const varName = (decl.id as AstNode)?.name as string | undefined;
        if (varName && decl.init) {
          varDeclarations.set(varName, decl.init as AstNode);
        }
      }
    }

    if (node.type === 'ExportDefaultDeclaration') {
      defaultExportNode = node.declaration as AstNode;
    }

    if (node.type === 'ExportNamedDeclaration') {
      const decl = node.declaration as AstNode | undefined;
      if (decl && decl.type === 'VariableDeclaration') {
        for (const declarator of (decl.declarations as AstNode[]) || []) {
          const name = (declarator.id as AstNode)?.name as string | undefined;
          if (name && name !== 'default') {
            let storyParams: Record<string, unknown> = {};
            let init = declarator.init as AstNode | undefined;

            if (
              init &&
              init.type === 'Identifier' &&
              typeof init.name === 'string' &&
              varDeclarations.has(init.name)
            ) {
              init = varDeclarations.get(init.name);
            }

            if (init && init.type === 'ObjectExpression') {
              for (const prop of (init.properties as AstNode[]) || []) {
                const key =
                  (prop.key as AstNode)?.name || (prop.key as AstNode)?.value;
                if (key === 'parameters') {
                  storyParams =
                    (extractLiteralValue(prop.value as AstNode) as Record<
                      string,
                      unknown
                    >) || {};
                }
              }
            }
            namedStories.push({ name, params: storyParams });
          }
        }
      }
    }
  }

  let defaultTitle = '';
  let defaultComponent = '';
  let defaultParams: Record<string, unknown> = {};

  let defaultObj = defaultExportNode;
  if (
    defaultObj &&
    defaultObj.type === 'Identifier' &&
    typeof defaultObj.name === 'string' &&
    varDeclarations.has(defaultObj.name)
  ) {
    defaultObj = varDeclarations.get(defaultObj.name) || null;
  }

  if (defaultObj && defaultObj.type === 'ObjectExpression') {
    for (const prop of (defaultObj.properties as AstNode[]) || []) {
      const key = (prop.key as AstNode)?.name || (prop.key as AstNode)?.value;
      if (key === 'title') {
        defaultTitle = String(extractLiteralValue(prop.value as AstNode) || '');
      } else if (key === 'component') {
        defaultComponent = String(
          (prop.value as AstNode)?.name ||
            extractLiteralValue(prop.value as AstNode) ||
            '',
        );
      } else if (key === 'parameters') {
        defaultParams =
          (extractLiteralValue(prop.value as AstNode) as Record<
            string,
            unknown
          >) || {};
      }
    }
  }

  if (!defaultTitle) {
    const baseName =
      filePath
        .split('/')
        .pop()
        ?.replace(/\.stories\.[^.]+$/, '') || 'Component';
    defaultTitle = baseName;
  }
  if (!defaultComponent) {
    defaultComponent = defaultTitle.split('/').pop() || defaultTitle;
  }

  const stories: StoryMetadata[] = [];
  for (const story of namedStories) {
    const effectiveParams: SnapshotStoryParameters = {
      ...(defaultParams.diffra || {}),
      ...(defaultParams.visual || {}),
      ...(defaultParams.snapshot || {}),
      ...(story.params.diffra || {}),
      ...(story.params.visual || {}),
      ...(story.params.snapshot || {}),
    };

    const isDisabled =
      effectiveParams.disableSnapshot === true ||
      effectiveParams.disable === true;

    if (isDisabled) {
      continue;
    }

    if (
      effectiveParams.diffThreshold !== undefined &&
      effectiveParams.threshold === undefined
    ) {
      effectiveParams.threshold = effectiveParams.diffThreshold;
    }

    // Convert modes into viewports if modes are specified
    if (effectiveParams.modes && !effectiveParams.viewports) {
      const modeViewports: ViewportInput[] = [];
      for (const [modeName, modeConfig] of Object.entries(
        effectiveParams.modes,
      )) {
        if (typeof modeConfig.viewport === 'number') {
          modeViewports.push({
            name: modeName,
            width: modeConfig.viewport,
            height: 800,
          });
        } else if (
          modeConfig.viewport &&
          typeof modeConfig.viewport.width === 'number'
        ) {
          modeViewports.push({
            name: modeName,
            width: modeConfig.viewport.width,
            height: modeConfig.viewport.height || 800,
          });
        }
      }
      if (modeViewports.length > 0) {
        effectiveParams.viewports = modeViewports;
      }
    }

    const mergedParams = {
      ...defaultParams,
      ...story.params,
      snapshot: effectiveParams,
      visual: effectiveParams,
      diffra: effectiveParams,
    };

    const id = toStoryId(defaultTitle, story.name);
    stories.push({
      id,
      name: story.name,
      component: defaultComponent,
      title: defaultTitle,
      filePath,
      parameters: mergedParams,
    });
  }

  return stories;
}

function parseCSFFallback(code: string, filePath: string): StoryMetadata[] {
  const stories: StoryMetadata[] = [];
  const titleMatch = code.match(/title\s*:\s*['"`]([^'"`]+)['"`]/);
  const title = titleMatch
    ? titleMatch[1]
    : filePath
        .split('/')
        .pop()
        ?.replace(/\.stories\.[^.]+$/, '') || 'Story';
  const component = title.split('/').pop() || title;

  const exportMatches = code.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=/g);
  for (const match of exportMatches) {
    const storyName = match[1];
    if (storyName && storyName !== 'default') {
      stories.push({
        id: toStoryId(title, storyName),
        name: storyName,
        component,
        title,
        filePath,
        parameters: {},
      });
    }
  }

  return stories;
}
