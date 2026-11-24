const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const input = path.resolve(
  __dirname,
  "./src/app/core/api/models/data-contracts.ts"
);
const outputDir = path.resolve(
  __dirname,
  "./src/app/core/api/models"
);

const sourceText = fs.readFileSync(input, "utf8");
const sourceFile = ts.createSourceFile(
  input,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);

function declarationKind(node) {
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    return "type";
  }
  return null;
}

function isExported(node) {
  return (
    node.modifiers?.some(
      modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
    ) ?? false
  );
}

function toKebabCase(name) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

const declarations = sourceFile.statements
  .filter(node => isExported(node) && declarationKind(node))
  .map(node => ({
    node,
    name: node.name.text,
    kind: declarationKind(node),
    fileName: toKebabCase(node.name.text),
  }));

const declarationsByName = new Map(
  declarations.map(declaration => [declaration.name, declaration])
);

// Не допускаем, чтобы разные имена записались в один файл.
const fileOwners = new Map();
for (const declaration of declarations) {
  const owner = fileOwners.get(declaration.fileName);

  if (owner && owner !== declaration.name) {
    throw new Error(
      `Имена ${owner} и ${declaration.name} дают одинаковое имя файла: ` +
      `${declaration.fileName}.ts`
    );
  }

  fileOwners.set(declaration.fileName, declaration.name);
}

function rootName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isQualifiedName(node)) return rootName(node.left);
  if (ts.isPropertyAccessExpression(node)) {
    return rootName(node.expression);
  }
  return null;
}

function collectDependencies(current) {
  // name -> true, если enum нужен как runtime-значение
  const dependencies = new Map();

  function addDependency(name, needsValue = false) {
    const dependency = declarationsByName.get(name);

    if (!dependency || dependency.name === current.name) return;

    const previous = dependencies.get(name) ?? false;
    dependencies.set(
      name,
      previous || (needsValue && dependency.kind === "enum")
    );
  }

  function visitEnumExpression(node) {
    if (ts.isIdentifier(node)) {
      addDependency(node.text, true);
    }

    ts.forEachChild(node, visitEnumExpression);
  }

  function visit(node) {
    if (ts.isTypeReferenceNode(node)) {
      addDependency(rootName(node.typeName));

      for (const typeArgument of node.typeArguments ?? []) {
        visit(typeArgument);
      }
      return;
    }

    if (ts.isExpressionWithTypeArguments(node)) {
      addDependency(rootName(node.expression));

      for (const typeArgument of node.typeArguments ?? []) {
        visit(typeArgument);
      }
      return;
    }

    if (ts.isTypeQueryNode(node)) {
      // Например: type X = typeof SomeEnum
      addDependency(rootName(node.exprName), true);

      for (const typeArgument of node.typeArguments ?? []) {
        visit(typeArgument);
      }
      return;
    }

    if (ts.isEnumDeclaration(node)) {
      for (const member of node.members) {
        if (member.initializer) {
          visitEnumExpression(member.initializer);
        }
      }
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(current.node);
  return dependencies;
}

fs.mkdirSync(outputDir, { recursive: true });

const indexExports = [];

for (const declaration of declarations) {
  const dependencies = collectDependencies(declaration);

  const imports = [...dependencies.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, needsValue]) => {
      const dependency = declarationsByName.get(name);

      if (dependency.kind === "enum" && needsValue) {
        return `import { ${name} } from './${dependency.fileName}';`;
      }

      return `import type { ${name} } from './${dependency.fileName}';`;
    });

  const declarationText = declaration.node
    .getFullText(sourceFile)
    .trim();

  const fileContent =
    [...imports, declarationText].filter(Boolean).join("\n\n") + "\n";

  fs.writeFileSync(
    path.join(outputDir, `${declaration.fileName}.ts`),
    fileContent
  );

  if (declaration.kind === "enum") {
    indexExports.push(
      `export { ${declaration.name} } from './${declaration.fileName}';`
    );
  } else {
    indexExports.push(
      `export type { ${declaration.name} } from './${declaration.fileName}';`
    );
  }
}

fs.writeFileSync(
  path.join(outputDir, "index.ts"),
  indexExports.join("\n") + "\n"
);

console.log(`Разбито на ${declarations.length} файлов`);
